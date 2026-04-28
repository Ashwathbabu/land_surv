import json
import os
import smtplib
import urllib.request
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance, ImageFilter
from pydantic import BaseModel, Field

try:
    import ee
    GEE_AVAILABLE = True
except ImportError:
    ee = None
    GEE_AVAILABLE = False


app = FastAPI(
    title="TerraWatch API",
    description="Land Protection Platform backend",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
ANALYSES_FILE = DATA_DIR / "analyses.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(BASE_DIR / ".env")

app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# ---------------------------------------------------------
# Models
# ---------------------------------------------------------

class Coordinate(BaseModel):
    lat: float
    lng: float


class AnalyzeRequest(BaseModel):
    name: str = Field(..., description="Name of the parcel")
    coordinates: List[Coordinate] = Field(..., min_length=3)
    date_before: str = Field(..., description="YYYY-MM-DD")
    date_after: str = Field(..., description="YYYY-MM-DD")
    email: Optional[str] = None


class AnalysisResult(BaseModel):
    id: str
    name: str
    date_before: str
    date_after: str
    area_hectares: float
    change_percentage: float
    change_detected: bool
    severity: str
    risk_score: float
    vegetation_change_percentage: float
    builtup_change_percentage: float
    image_before_url: str
    image_after_url: str
    image_diff_url: str
    image_before_crop_url: Optional[str] = None
    image_after_crop_url: Optional[str] = None
    image_diff_crop_url: Optional[str] = None
    created_at: str
    mode: str


# ---------------------------------------------------------
# Env / file helpers
# ---------------------------------------------------------

def env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    if isinstance(value, str):
        value = value.strip()
    return value or default


def load_analyses() -> List[dict]:
    if not ANALYSES_FILE.exists():
        return []
    try:
        return json.loads(ANALYSES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_analyses(analyses: List[dict]) -> None:
    ANALYSES_FILE.write_text(json.dumps(analyses, indent=2), encoding="utf-8")


# ---------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------

def clean_polygon(coords: List[Coordinate]) -> List[Coordinate]:
    cleaned: List[Coordinate] = []
    for p in coords:
        if not cleaned:
            cleaned.append(p)
            continue
        prev = cleaned[-1]
        if abs(prev.lat - p.lat) > 1e-10 or abs(prev.lng - p.lng) > 1e-10:
            cleaned.append(p)

    if len(cleaned) > 1:
        first = cleaned[0]
        last = cleaned[-1]
        if abs(first.lat - last.lat) < 1e-10 and abs(first.lng - last.lng) < 1e-10:
            cleaned.pop()

    return cleaned


def polygon_area_hectares(coords: List[Coordinate]) -> float:
    coords = clean_polygon(coords)
    if len(coords) < 3:
        return 0.0

    earth_radius_m = 6371000.0
    mean_lat = np.mean([c.lat for c in coords])
    cos_lat = np.cos(np.radians(mean_lat))

    xs = [np.radians(c.lng) * earth_radius_m * cos_lat for c in coords]
    ys = [np.radians(c.lat) * earth_radius_m for c in coords]

    area = 0.0
    n = len(coords)
    for i in range(n):
        j = (i + 1) % n
        area += xs[i] * ys[j]
        area -= xs[j] * ys[i]

    area = abs(area) / 2.0
    return round(area / 10000.0, 4)


# ---------------------------------------------------------
# Earth Engine init
# ---------------------------------------------------------

GEE_STATUS = {
    "enabled": False,
    "mode": "demo",
    "reason": "Not initialized yet",
}


def initialize_earth_engine() -> Tuple[bool, str]:
    if not GEE_AVAILABLE:
        return False, "earthengine-api is not installed"

    project_id = env("GEE_PROJECT_ID")
    sa_email = env("GEE_SERVICE_ACCOUNT_EMAIL")
    sa_file = env("GEE_SERVICE_ACCOUNT_FILE")
    sa_key = env("GEE_SERVICE_ACCOUNT_KEY")

    try:
        if sa_email and sa_file:
            if not Path(sa_file).exists():
                return False, f"Service account file not found: {sa_file}"
            credentials = ee.ServiceAccountCredentials(sa_email, key_file=sa_file)
            if project_id:
                ee.Initialize(credentials=credentials, project=project_id)
            else:
                ee.Initialize(credentials=credentials)
            return True, "Initialized with service account file"

        if sa_email and sa_key:
            credentials = ee.ServiceAccountCredentials(sa_email, key_data=sa_key)
            if project_id:
                ee.Initialize(credentials=credentials, project=project_id)
            else:
                ee.Initialize(credentials=credentials)
            return True, "Initialized with inline service account JSON"

        if project_id:
            ee.Initialize(project=project_id)
        else:
            ee.Initialize()
        return True, "Initialized with local Earth Engine user auth"

    except Exception as e:
        return False, str(e)


def refresh_gee_status() -> None:
    ok, reason = initialize_earth_engine()
    GEE_STATUS["enabled"] = ok
    GEE_STATUS["mode"] = "gee" if ok else "demo"
    GEE_STATUS["reason"] = reason
    if ok:
        print(f"[GEE] LIVE MODE ENABLED: {reason}")
    else:
        print(f"[GEE] DEMO MODE: {reason}")


# ---------------------------------------------------------
# Image helpers
# ---------------------------------------------------------

def enhance_satellite_rgb(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.18)
    img = ImageEnhance.Color(img).enhance(1.12)
    img = ImageEnhance.Sharpness(img).enhance(1.20)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    return img


def save_image(img: Image.Image, path: Path) -> None:
    img.save(path, format="PNG")


def compute_bbox_from_mask(mask: np.ndarray, padding: int = 30) -> Optional[Tuple[int, int, int, int]]:
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return None

    x1 = max(0, int(xs.min()) - padding)
    y1 = max(0, int(ys.min()) - padding)
    x2 = min(mask.shape[1], int(xs.max()) + padding + 1)
    y2 = min(mask.shape[0], int(ys.max()) + padding + 1)

    if x2 - x1 < 24 or y2 - y1 < 24:
        return None

    return x1, y1, x2, y2


def crop_from_bbox(img: Image.Image, bbox: Optional[Tuple[int, int, int, int]]) -> Optional[Image.Image]:
    if not bbox:
        return None
    return img.crop(bbox)


# ---------------------------------------------------------
# GEE image fetch
# ---------------------------------------------------------

def build_gee_collection(aoi, target_date_str: str):
    target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
    start = (target_date - timedelta(days=35)).strftime("%Y-%m-%d")
    end = (target_date + timedelta(days=35)).strftime("%Y-%m-%d")

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    )
    return collection


def fetch_sentinel_rgb_and_ndvi_gee(polygon_coords: List[List[float]], date_str: str) -> Tuple[Image.Image, np.ndarray]:
    aoi = ee.Geometry.Polygon([polygon_coords])
    collection = build_gee_collection(aoi, date_str)

    count = collection.size().getInfo()
    if not count or count == 0:
        raise RuntimeError(f"No Sentinel-2 images found for {date_str}")

    image = collection.median().clip(aoi)

    rgb = image.select(["B4", "B3", "B2"])
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")

    rgb_thumb_url = rgb.getThumbURL(
        {
            "region": aoi,
            "dimensions": 1600,
            "format": "png",
            "min": 150,
            "max": 2800,
        }
    )

    ndvi_thumb_url = ndvi.getThumbURL(
        {
            "region": aoi,
            "dimensions": 1600,
            "format": "png",
            "min": -0.2,
            "max": 0.8,
            "palette": ["0000ff", "ffffff", "00ff00"],
        }
    )

    with urllib.request.urlopen(rgb_thumb_url, timeout=60) as response:
        rgb_bytes = response.read()

    with urllib.request.urlopen(ndvi_thumb_url, timeout=60) as response:
        ndvi_bytes = response.read()

    rgb_img = Image.open(BytesIO(rgb_bytes)).convert("RGB")
    ndvi_img = Image.open(BytesIO(ndvi_bytes)).convert("RGB")

    rgb_img = enhance_satellite_rgb(rgb_img)

    ndvi_arr = np.array(ndvi_img).astype(np.float32)
    green = ndvi_arr[:, :, 1]
    blue = ndvi_arr[:, :, 2]
    red = ndvi_arr[:, :, 0]

    ndvi_scalar = (green - red + (green - blue) * 0.5) / 255.0
    ndvi_scalar = np.clip(ndvi_scalar, -1.0, 1.0)

    return rgb_img, ndvi_scalar


# ---------------------------------------------------------
# Demo fallback
# ---------------------------------------------------------

def generate_demo_image(polygon_coords: List[List[float]], variant: str = "before") -> Tuple[Image.Image, np.ndarray]:
    size = 1024
    seed = hash((tuple(tuple(c) for c in polygon_coords), "base")) % (2**31)
    rng = np.random.RandomState(seed)

    def smooth_noise(scale: int, amp: float) -> np.ndarray:
        small = rng.rand(max(2, size // scale), max(2, size // scale))
        img = Image.fromarray((small * 255).astype(np.uint8))
        arr = np.array(img.resize((size, size), Image.BICUBIC)) / 255.0
        return arr * amp

    terrain = np.zeros((size, size), dtype=np.float32)
    for sc, amp in [(64, 0.60), (32, 0.25), (16, 0.10), (8, 0.05)]:
        terrain += smooth_noise(sc, amp)

    terrain = (terrain - terrain.min()) / (terrain.max() - terrain.min() + 1e-9)

    base = np.zeros((size, size, 3), dtype=np.float32)
    base[..., 0] = 0.18 + terrain * 0.35
    base[..., 1] = 0.32 + terrain * 0.25
    base[..., 2] = 0.14 + terrain * 0.20

    ndvi = (base[..., 1] - base[..., 0]) * 1.7
    ndvi = np.clip(ndvi, -1.0, 1.0)

    noise = rng.randn(size, size, 3) * 0.015
    base = np.clip(base + noise, 0, 1)

    if variant == "after":
        seed2 = hash((tuple(tuple(c) for c in polygon_coords), "change")) % (2**31)
        rng2 = np.random.RandomState(seed2)
        cx, cy = rng2.randint(180, 844), rng2.randint(180, 844)
        radius_x = rng2.randint(60, 140)
        radius_y = rng2.randint(45, 120)

        y, x = np.ogrid[:size, :size]
        mask = (((x - cx) / radius_x) ** 2 + ((y - cy) / radius_y) ** 2) <= 1.0

        target = np.array([0.58, 0.44, 0.31], dtype=np.float32)
        base[mask] = target
        ndvi[mask] -= 0.35
        ndvi = np.clip(ndvi, -1.0, 1.0)

    img_arr = (np.clip(base, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(img_arr, mode="RGB"), ndvi


def fetch_image_and_ndvi(polygon_coords: List[List[float]], date_str: str, variant: str) -> Tuple[Image.Image, np.ndarray, str]:
    if GEE_STATUS["enabled"]:
        try:
            img, ndvi = fetch_sentinel_rgb_and_ndvi_gee(polygon_coords, date_str)
            return img, ndvi, "gee"
        except Exception as e:
            print(f"[GEE] Fetch failed for {date_str}: {e}. Falling back to demo image.")
    img, ndvi = generate_demo_image(polygon_coords, variant=variant)
    return img, ndvi, "demo"


# ---------------------------------------------------------
# Better detection / risk engine
# ---------------------------------------------------------

def detect_change_advanced(
    img_before: Image.Image,
    img_after: Image.Image,
    ndvi_before: np.ndarray,
    ndvi_after: np.ndarray,
) -> dict:
    target_size = (1024, 1024)

    img_before = img_before.resize(target_size, Image.LANCZOS)
    img_after = img_after.resize(target_size, Image.LANCZOS)

    before_arr = np.array(img_before).astype(np.int16)
    after_arr = np.array(img_after).astype(np.int16)

    ndvi_before_img = Image.fromarray(
        np.uint8(np.clip((ndvi_before + 1.0) * 127.5, 0, 255))
    ).resize(target_size, Image.BILINEAR)
    ndvi_after_img = Image.fromarray(
        np.uint8(np.clip((ndvi_after + 1.0) * 127.5, 0, 255))
    ).resize(target_size, Image.BILINEAR)

    ndvi_before_res = np.array(ndvi_before_img).astype(np.float32) / 127.5 - 1.0
    ndvi_after_res = np.array(ndvi_after_img).astype(np.float32) / 127.5 - 1.0

    rgb_diff = np.abs(after_arr - before_arr).astype(np.float32)
    gray_diff = rgb_diff.mean(axis=2)

    ndvi_diff = np.abs(ndvi_after_res - ndvi_before_res)

    changed_mask = gray_diff > 22
    strong_change_mask = gray_diff > 35
    vegetation_mask = ndvi_diff > 0.18
    builtup_like_mask = strong_change_mask & (ndvi_diff < 0.12)

    height, width = gray_diff.shape
    edge_margin = int(min(height, width) * 0.08)
    edge_mask = np.zeros_like(changed_mask, dtype=bool)
    edge_mask[:edge_margin, :] = True
    edge_mask[-edge_margin:, :] = True
    edge_mask[:, :edge_margin] = True
    edge_mask[:, -edge_margin:] = True

    total_pixels = changed_mask.size
    changed_pixels = int(changed_mask.sum())
    vegetation_pixels = int((changed_mask & vegetation_mask).sum())
    builtup_pixels = int(builtup_like_mask.sum())
    edge_pixels = int((changed_mask & edge_mask).sum())

    change_pct = (changed_pixels / total_pixels) * 100.0
    vegetation_pct = (vegetation_pixels / total_pixels) * 100.0
    builtup_pct = (builtup_pixels / total_pixels) * 100.0
    edge_pct = (edge_pixels / total_pixels) * 100.0

    risk_score = (
        change_pct * 1.0
        + builtup_pct * 3.2
        + edge_pct * 2.3
        - vegetation_pct * 1.3
    )
    risk_score = max(0.0, round(risk_score, 2))

    if risk_score < 1.0 and change_pct < 1.0:
        severity = "none"
    elif risk_score < 5.0:
        severity = "low"
    elif risk_score < 15.0:
        severity = "moderate"
    else:
        severity = "high"

    overlay = after_arr.astype(np.float32).copy()

    red_overlay = np.zeros_like(overlay)
    red_overlay[:, :, 0] = 255

    yellow_overlay = np.zeros_like(overlay)
    yellow_overlay[:, :, 0] = 255
    yellow_overlay[:, :, 1] = 210

    green_overlay = np.zeros_like(overlay)
    green_overlay[:, :, 1] = 255

    overlay[changed_mask] = overlay[changed_mask] * 0.55 + yellow_overlay[changed_mask] * 0.45
    overlay[vegetation_mask & changed_mask] = (
        overlay[vegetation_mask & changed_mask] * 0.55 + green_overlay[vegetation_mask & changed_mask] * 0.45
    )
    overlay[builtup_like_mask] = overlay[builtup_like_mask] * 0.40 + red_overlay[builtup_like_mask] * 0.60

    overlay_img = Image.fromarray(np.clip(overlay, 0, 255).astype(np.uint8), mode="RGB")

    crop_bbox = compute_bbox_from_mask(changed_mask, padding=50)

    return {
        "change_percentage": round(change_pct, 2),
        "vegetation_change_percentage": round(vegetation_pct, 2),
        "builtup_change_percentage": round(builtup_pct, 2),
        "change_detected": change_pct >= 0.8,
        "severity": severity,
        "risk_score": risk_score,
        "highlight_image": overlay_img,
        "crop_bbox": crop_bbox,
    }


# ---------------------------------------------------------
# Email
# ---------------------------------------------------------

def send_alert_email(to_email: str, result: AnalysisResult) -> bool:
    smtp_host = env("SMTP_HOST")
    smtp_port = int(env("SMTP_PORT", "587"))
    smtp_user = env("SMTP_USER")
    smtp_pass = env("SMTP_PASS")
    smtp_from = env("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        print("[EMAIL] SMTP not configured. Skipping alert.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"⚠️ Land change detected: {result.name}"
        msg["From"] = smtp_from
        msg["To"] = to_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;">
            <h2 style="color:#b42318;">Land Change Alert</h2>
            <p><strong>{result.name}</strong></p>
            <ul>
                <li>Change percentage: <strong>{result.change_percentage}%</strong></li>
                <li>Built-up-like change: <strong>{result.builtup_change_percentage}%</strong></li>
                <li>Vegetation change: <strong>{result.vegetation_change_percentage}%</strong></li>
                <li>Risk score: <strong>{result.risk_score}</strong></li>
                <li>Severity: <strong>{result.severity.upper()}</strong></li>
                <li>Area: {result.area_hectares} hectares</li>
                <li>Period: {result.date_before} → {result.date_after}</li>
                <li>Mode: {result.mode.upper()}</li>
            </ul>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())

        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send alert: {e}")
        return False


# ---------------------------------------------------------
# Startup
# ---------------------------------------------------------

@app.on_event("startup")
def startup_event():
    refresh_gee_status()


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "TerraWatch API",
        "version": "0.3.0",
        "mode": GEE_STATUS["mode"],
        "gee_enabled": GEE_STATUS["enabled"],
        "gee_reason": GEE_STATUS["reason"],
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gee": GEE_STATUS["enabled"],
        "mode": GEE_STATUS["mode"],
        "reason": GEE_STATUS["reason"],
    }


@app.get("/api/gee-status")
def gee_status():
    return {
        "gee_available_package": GEE_AVAILABLE,
        "gee_enabled": GEE_STATUS["enabled"],
        "mode": GEE_STATUS["mode"],
        "reason": GEE_STATUS["reason"],
        "project_id": env("GEE_PROJECT_ID"),
        "has_service_account_email": bool(env("GEE_SERVICE_ACCOUNT_EMAIL")),
        "has_service_account_key": bool(env("GEE_SERVICE_ACCOUNT_KEY")),
        "has_service_account_file": bool(env("GEE_SERVICE_ACCOUNT_FILE")),
    }


@app.post("/api/reinit-gee")
def reinit_gee():
    refresh_gee_status()
    return {
        "message": "GEE initialization retried",
        "gee_enabled": GEE_STATUS["enabled"],
        "mode": GEE_STATUS["mode"],
        "reason": GEE_STATUS["reason"],
    }


@app.post("/api/analyze", response_model=AnalysisResult)
def analyze(req: AnalyzeRequest):
    coords = clean_polygon(req.coordinates)

    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Polygon needs at least 3 valid points.")

    try:
        before_dt = datetime.strptime(req.date_before, "%Y-%m-%d")
        after_dt = datetime.strptime(req.date_after, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format.")

    if after_dt < before_dt:
        raise HTTPException(status_code=400, detail="date_after must be on or after date_before.")

    gee_coords = [[c.lng, c.lat] for c in coords]

    img_before, ndvi_before, mode_before = fetch_image_and_ndvi(gee_coords, req.date_before, "before")
    img_after, ndvi_after, mode_after = fetch_image_and_ndvi(gee_coords, req.date_after, "after")
    mode = "gee" if mode_before == "gee" and mode_after == "gee" else "demo"

    detection = detect_change_advanced(img_before, img_after, ndvi_before, ndvi_after)
    area = polygon_area_hectares(coords)

    analysis_id = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    analysis_dir = IMAGES_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)

    img_before = img_before.resize((1024, 1024), Image.LANCZOS)
    img_after = img_after.resize((1024, 1024), Image.LANCZOS)

    before_path = analysis_dir / "before.png"
    after_path = analysis_dir / "after.png"
    diff_path = analysis_dir / "diff.png"

    save_image(img_before, before_path)
    save_image(img_after, after_path)
    save_image(detection["highlight_image"], diff_path)

    before_crop_url = None
    after_crop_url = None
    diff_crop_url = None

    crop_bbox = detection.get("crop_bbox")
    if crop_bbox:
        before_crop = crop_from_bbox(img_before, crop_bbox)
        after_crop = crop_from_bbox(img_after, crop_bbox)
        diff_crop = crop_from_bbox(detection["highlight_image"], crop_bbox)

        if before_crop and after_crop and diff_crop:
            before_crop = before_crop.resize((700, 700), Image.LANCZOS)
            after_crop = after_crop.resize((700, 700), Image.LANCZOS)
            diff_crop = diff_crop.resize((700, 700), Image.LANCZOS)

            before_crop_path = analysis_dir / "before_crop.png"
            after_crop_path = analysis_dir / "after_crop.png"
            diff_crop_path = analysis_dir / "diff_crop.png"

            save_image(before_crop, before_crop_path)
            save_image(after_crop, after_crop_path)
            save_image(diff_crop, diff_crop_path)

            before_crop_url = f"/images/{analysis_id}/before_crop.png"
            after_crop_url = f"/images/{analysis_id}/after_crop.png"
            diff_crop_url = f"/images/{analysis_id}/diff_crop.png"

    result = AnalysisResult(
        id=analysis_id,
        name=req.name,
        date_before=req.date_before,
        date_after=req.date_after,
        area_hectares=area,
        change_percentage=detection["change_percentage"],
        change_detected=detection["change_detected"],
        severity=detection["severity"],
        risk_score=detection["risk_score"],
        vegetation_change_percentage=detection["vegetation_change_percentage"],
        builtup_change_percentage=detection["builtup_change_percentage"],
        image_before_url=f"/images/{analysis_id}/before.png",
        image_after_url=f"/images/{analysis_id}/after.png",
        image_diff_url=f"/images/{analysis_id}/diff.png",
        image_before_crop_url=before_crop_url,
        image_after_crop_url=after_crop_url,
        image_diff_crop_url=diff_crop_url,
        created_at=datetime.utcnow().isoformat(),
        mode=mode,
    )

    analyses = load_analyses()
    record = result.model_dump()
    record["coordinates"] = [c.model_dump() for c in coords]
    analyses.append(record)
    save_analyses(analyses)

    if req.email and detection["change_detected"]:
        send_alert_email(req.email, result)

    return result


@app.get("/api/analyses")
def list_analyses():
    analyses = load_analyses()
    return sorted(analyses, key=lambda x: x.get("created_at", ""), reverse=True)


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: str):
    analyses = load_analyses()
    for item in analyses:
        if item.get("id") == analysis_id:
            return item
    raise HTTPException(status_code=404, detail="Analysis not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)