# TERRAWATCH — Land Protection Platform

**Phase 0 MVP** · Satellite-based land change detection for protected parcels across India.

> _Draw a boundary. Pick two dates. TerraWatch fetches Sentinel-2 imagery, compares
> pixel-by-pixel, and highlights exactly where the land has changed._

---

## What's included

```
land-protection-platform/
├── frontend/        React + Vite + Leaflet (drawing UI, results dashboard)
├── backend/         FastAPI + NumPy + Pillow + Google Earth Engine
└── README.md        You are here
```

### Phase 0 scope (what we built)

- ✅ Map-based land selection (Leaflet + leaflet-draw, satellite basemap)
- ✅ Backend fetches Sentinel-2 imagery via Google Earth Engine
- ✅ **Demo fallback mode** — works without GEE credentials for instant testing
- ✅ Pixel-difference change detection with threshold classification
- ✅ Before / After / Change-overlay viewer
- ✅ Severity classification (none / low / moderate / high)
- ✅ Area calculation in hectares
- ✅ Local JSON storage of past analyses
- ✅ Optional email alerts (SMTP)
- ✅ Professional, production-grade UI

### Explicitly out of scope (Phase 1+)

- ❌ Authentication / user accounts
- ❌ OCR / AI models / NDVI
- ❌ Payment / government integration
- ❌ Database (uses local JSON)

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # on Windows: venv\Scripts\activate
pip install -r requirements.txt

# optional — for live Sentinel-2 imagery
cp .env.example .env
# edit .env with your GEE service-account credentials

# run
bash run.sh
# or: python -m uvicorn app.main:app --reload
```

Backend runs on **http://localhost:8000** · API docs at **/docs**.

> If no GEE credentials are configured, the backend automatically runs in
> **demo mode** and generates synthetic satellite-style imagery. This means
> you can demo the entire pipeline end-to-end without signing up for GEE.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173** and proxies API calls to the backend.

To use the Google satellite basemap in the frontend, create `frontend/.env`
and set:

```bash
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

If the key is missing or invalid, the app falls back to the existing Esri
satellite basemap so local development still works.

---

## Google Earth Engine setup (for live mode)

1. Sign up at https://earthengine.google.com/
2. Create a Google Cloud service account with Earth Engine access
3. Download the JSON key
4. In `backend/.env`:
   ```
   GEE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
   GEE_SERVICE_ACCOUNT_KEY=<paste entire JSON contents as one line>
   ```

---

## Email alerts setup (optional)

In `backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=<app password>
SMTP_FROM=you@gmail.com
```

When a user provides an email and change is detected, an alert is sent automatically.

---

## How change detection works (Phase 0)

1. **Fetch.** Two Sentinel-2 median composites are pulled for a ±30 day window
   around each selected date, filtered to <30% cloud cover.
2. **Align.** Both images are resized to 512×512.
3. **Differ.** Absolute pixel difference → grayscale → thresholded at `|Δ| > 45`.
4. **Classify.** % of changed pixels maps to severity:
   - `< 1%` → none
   - `1–5%` → low
   - `5–15%` → moderate
   - `> 15%` → high
5. **Visualize.** Changed pixels are overlaid in red on the "after" image.

This is deliberately simple for Phase 0. Phase 1 will layer in NDVI, buffer zones,
and ML-based classification.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health + mode (live/demo) |
| `POST` | `/api/analyze` | Run change detection on a polygon |
| `GET` | `/api/analyses` | List all past analyses |
| `GET` | `/api/analyses/{id}` | Fetch single analysis |
| `GET` | `/images/{id}/...` | Static images from analyses |

Example request:
```json
POST /api/analyze
{
  "name": "Aravalli Grove",
  "coordinates": [
    { "lat": 28.45, "lng": 77.05 },
    { "lat": 28.46, "lng": 77.07 },
    { "lat": 28.44, "lng": 77.08 }
  ],
  "date_before": "2024-04-15",
  "date_after": "2026-04-15",
  "email": "alert@example.com"
}
```

---

## Tech stack

- **Frontend:** React 18 · Vite · Leaflet · leaflet-draw
- **Backend:** FastAPI · Pydantic v2 · NumPy · Pillow
- **Geo:** Google Earth Engine (Sentinel-2 SR Harmonized)
- **Storage:** Local JSON (no database)
- **Typography:** Fraunces (display) · Manrope (body) · JetBrains Mono (code)

---

## Design notes

The UI commits to an editorial-dark aesthetic: deep forest background, warm
amber accents, Fraunces serif for titles. Every element has a reason — the
grain overlay adds analog texture, the corner marks on imagery reference
satellite targeting reticles, the monospace labels signal technical/scientific
content. Built to feel trustworthy for users who care about land.

---

## Roadmap (beyond Phase 0)

- **Phase 1:** NDVI analysis, cloud-masked composites, buffer zones
- **Phase 2:** User accounts, scheduled monitoring, dashboard
- **Phase 3:** ML classification (deforestation vs construction vs fire)
- **Phase 4:** Government/NGO integration, mobile app

---

**Built for the Land Protection initiative · April 2026**
