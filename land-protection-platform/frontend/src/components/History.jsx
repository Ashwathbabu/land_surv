import { useEffect, useState } from 'react';

export default function History() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => {
        setAnalyses(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sevColor = {
    none: '#4a7c59',
    low: '#d4a574',
    moderate: '#d97757',
    high: '#c23b22',
  };

  return (
    <section className="history">
      <div className="section-head">
        <span className="section-num">§ 02</span>
        <h2>Prior analyses</h2>
        <p className="section-sub">
          Every parcel you've analyzed, newest first. Click to inspect.
        </p>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : analyses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◎</div>
          <h3>No analyses yet</h3>
          <p>Run your first analysis from the Analyze tab.</p>
        </div>
      ) : (
        <div className="history-grid">
          <div className="history-list">
            {analyses.map((a) => (
              <button
                key={a.id}
                className={`history-item ${selected?.id === a.id ? 'active' : ''}`}
                onClick={() => setSelected(a)}
              >
                <div className="hi-left">
                  <div className="hi-name">{a.name}</div>
                  <div className="hi-meta">
                    {a.date_before} → {a.date_after}
                  </div>
                </div>
                <div className="hi-right">
                  <span
                    className="hi-sev"
                    style={{ background: sevColor[a.severity] || '#4a7c59' }}
                  >
                    {a.change_percentage}%
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="history-detail">
            {selected ? (
              <>
                <h3>{selected.name}</h3>
                <dl className="detail-dl">
                  <div><dt>Baseline</dt><dd>{selected.date_before}</dd></div>
                  <div><dt>Current</dt><dd>{selected.date_after}</dd></div>
                  <div><dt>Area</dt><dd>{selected.area_hectares} ha</dd></div>
                  <div>
                    <dt>Change</dt>
                    <dd>
                      <span
                        className="hi-sev"
                        style={{ background: sevColor[selected.severity] || '#4a7c59' }}
                      >
                        {selected.change_percentage}% · {selected.severity}
                      </span>
                    </dd>
                  </div>
                  <div><dt>Mode</dt><dd>{selected.mode}</dd></div>
                </dl>
                <div className="detail-images">
                  <figure>
                    <img src={selected.image_before_url} alt="Before" />
                    <figcaption>Before</figcaption>
                  </figure>
                  <figure>
                    <img src={selected.image_after_url} alt="After" />
                    <figcaption>After</figcaption>
                  </figure>
                  <figure>
                    <img src={selected.image_diff_url} alt="Diff" />
                    <figcaption>Change</figcaption>
                  </figure>
                </div>
              </>
            ) : (
              <div className="detail-empty">Select an analysis to view details.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
