export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark">TERRAWATCH</span>
          <p>Phase 0 · Prototype for satellite-based land change detection.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h5>System</h5>
            <ul>
              <li>Sentinel-2 imagery</li>
              <li>Google Earth Engine</li>
              <li>Copernicus data</li>
            </ul>
          </div>
          <div>
            <h5>Stack</h5>
            <ul>
              <li>React + Leaflet</li>
              <li>FastAPI + NumPy</li>
              <li>Pillow imaging</li>
            </ul>
          </div>
          <div>
            <h5>Scope</h5>
            <ul>
              <li>Land change detection</li>
              <li>Before / after comparison</li>
              <li>Optional email alerts</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 TerraWatch · Built for the Land Protection initiative.</span>
        <span className="coord">28.6139° N · 77.2090° E</span>
      </div>
    </footer>
  );
}
