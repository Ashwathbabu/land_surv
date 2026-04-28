import { useState, useRef } from 'react';
import MapCanvas from './MapCanvas.jsx';
import ResultPanel from './ResultPanel.jsx';

export default function Workspace() {
  const [polygon, setPolygon] = useState(null);
  const [name, setName] = useState('');
  const [dateBefore, setDateBefore] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [dateAfter, setDateAfter] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().slice(0, 10);
  });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  const canAnalyze = polygon && polygon.length >= 3 && name.trim() && dateBefore && dateAfter && !loading;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          coordinates: polygon,
          date_before: dateBefore,
          date_after: dateAfter,
          email: email || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Analysis failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setPolygon(null);
    if (mapRef.current?.clearDrawings) {
      mapRef.current.clearDrawings();
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-grid">
        <aside className="control-panel">
          <div className="panel-head">
            <span className="panel-num">§ 02</span>
            <h2>Define the parcel</h2>
            <p className="panel-sub">
              Use the draw tool on the map to trace a polygon around the land
              you want to monitor. Smaller parcels detect finer changes.
            </p>
          </div>

          <div className="field">
            <label htmlFor="name">
              <span className="field-num">01</span>Parcel name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Aravalli Grove, Gurugram"
              disabled={loading}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="date-before">
                <span className="field-num">02</span>Baseline date
              </label>
              <input
                id="date-before"
                type="date"
                value={dateBefore}
                onChange={e => setDateBefore(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="field">
              <label htmlFor="date-after">
                <span className="field-num">03</span>Current date
              </label>
              <input
                id="date-after"
                type="date"
                value={dateAfter}
                onChange={e => setDateAfter(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">
              <span className="field-num">04</span>Alert email <span className="opt">optional</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div className="polygon-status">
            <div className="ps-dot" data-active={polygon && polygon.length >= 3} />
            <span>
              {polygon && polygon.length >= 3
                ? `Polygon set · ${polygon.length} vertices`
                : 'Draw a polygon on the map'}
            </span>
          </div>

          {error && (
            <div className="error-box" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="actions">
            <button
              className="btn btn-primary btn-block"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
            >
              {loading ? (
                <>
                  <Spinner />
                  Analyzing satellite data…
                </>
              ) : (
                <>
                  Run change detection
                  <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path d="M1 5H17M17 5L13 1M17 5L13 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </>
              )}
            </button>
            {result && (
              <button className="btn btn-ghost btn-block" onClick={handleReset}>
                New analysis
              </button>
            )}
          </div>

          <div className="legend">
            <h4>Severity scale</h4>
            <div className="legend-items">
              <div><span className="dot dot-none" /> &lt; 1% · none</div>
              <div><span className="dot dot-low" /> 1–5% · low</div>
              <div><span className="dot dot-moderate" /> 5–15% · moderate</div>
              <div><span className="dot dot-high" /> &gt; 15% · high</div>
            </div>
          </div>
        </aside>

        <div className="map-area">
          <MapCanvas ref={mapRef} onPolygonChange={setPolygon} />
        </div>
      </div>

      {(loading || result) && (
        <ResultPanel loading={loading} result={result} />
      )}
    </section>
  );
}

function Spinner() {
  return (
    <svg className="spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
