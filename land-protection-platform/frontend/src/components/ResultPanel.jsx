import { useEffect, useMemo, useState } from 'react';

function normalizeImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url;
}

function Stage({ label, delay = 0 }) {
  return (
    <div className="stage" style={{ animationDelay: `${delay}s` }}>
      <span className="stage-bar" />
      <span className="stage-label">{label}</span>
    </div>
  );
}

function ImageCard({ title, subtitle, src, alt, onErrorMessage }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      style={{
        border: '1px solid rgba(212,165,116,0.2)',
        background: 'rgba(7, 23, 17, 0.72)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minHeight: '100%',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#d4a574',
            marginBottom: '6px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '0.82rem',
            color: 'rgba(232, 225, 205, 0.72)',
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: '280px',
          background: 'rgba(20, 34, 28, 0.9)',
          border: '1px solid rgba(232,188,135,0.18)',
          overflow: 'hidden',
        }}
      >
        {!failed && src ? (
          <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '280px',
              objectFit: 'contain',
              display: 'block',
              background: '#1b2621',
            }}
          />
        ) : (
          <div
            style={{
              minHeight: '280px',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              padding: '1.25rem',
              color: '#e8bc87',
              fontSize: '0.82rem',
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                Could not display image
              </strong>
              <div>{onErrorMessage}</div>
            </div>
          </div>
        )}

        <div className="image-corners">
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
        </div>
      </div>
    </div>
  );
}

export default function ResultPanel({ loading, result }) {
  const [overlayError, setOverlayError] = useState(false);

  useEffect(() => {
    setOverlayError(false);
  }, [result?.id]);

  const images = useMemo(
    () => ({
      before: normalizeImageUrl(result?.image_before_url || ''),
      after: normalizeImageUrl(result?.image_after_url || ''),
      diff: normalizeImageUrl(result?.image_diff_url || ''),
      beforeCrop: normalizeImageUrl(result?.image_before_crop_url || ''),
      afterCrop: normalizeImageUrl(result?.image_after_crop_url || ''),
      diffCrop: normalizeImageUrl(result?.image_diff_crop_url || ''),
    }),
    [result]
  );

  if (loading) {
    return (
      <section className="result-panel loading">
        <div className="panel-head">
          <span className="panel-num">§ 03</span>
          <h2>Processing…</h2>
        </div>

        <div className="loading-stages">
          <Stage label="Fetching baseline imagery" />
          <Stage label="Fetching current imagery" delay={0.5} />
          <Stage label="Computing pixel-wise difference" delay={1} />
          <Stage label="Preparing comparison views" delay={1.5} />
        </div>
      </section>
    );
  }

  if (!result) return null;

  const sevColor =
    {
      none: '#4a7c59',
      low: '#d4a574',
      moderate: '#d97757',
      high: '#c23b22',
    }[result.severity] || '#d4a574';

  const hasCropViews = Boolean(images.beforeCrop && images.afterCrop && images.diffCrop);

  return (
    <section className="result-panel">
      <div className="panel-head">
        <span className="panel-num">§ 03</span>
        <h2>Analysis complete</h2>
        <p className="panel-sub">
          {result.name} · {result.date_before} → {result.date_after}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '22px',
          alignItems: 'start',
        }}
      >
        <div className="metrics">
          <div className="metric metric-primary" style={{ '--sev-color': sevColor }}>
            <div className="metric-label">Change detected</div>
            <div className="metric-value">
              {result.change_percentage}
              <span className="metric-unit">%</span>
            </div>
            <div className="metric-sub">
              <span className="sev-badge" style={{ background: sevColor }}>
                {String(result.severity || '').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="metric">
            <div className="metric-label">Parcel area</div>
            <div className="metric-value">
              {result.area_hectares}
              <span className="metric-unit">ha</span>
            </div>
            <div className="metric-sub-small">
              {Number(result.area_hectares) > 0
                ? 'Computed from the selected parcel'
                : 'Area came back as zero — redraw parcel before trusting this result'}
            </div>
          </div>

          <div className="metric">
            <div className="metric-label">Imagery mode</div>
            <div className="metric-value-small">
              {result.mode === 'gee' ? 'SENTINEL-2' : 'DEMO'}
            </div>
            <div className="metric-sub-small">
              {result.mode === 'gee'
                ? 'Live satellite composite'
                : 'Synthetic imagery fallback'}
            </div>
          </div>

          <div className="metric">
            <div className="metric-label">Status</div>
            <div className="metric-value-small">
              {result.change_detected ? '⚠ Flagged' : '✓ Stable'}
            </div>
            <div className="metric-sub-small">
              {result.change_detected
                ? 'Visual comparison recommended below'
                : 'No significant change detected'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          <div
            style={{
              border: '1px solid rgba(212,165,116,0.14)',
              padding: '14px',
              background:
                'linear-gradient(180deg, rgba(10,33,24,0.86) 0%, rgba(7,21,16,0.9) 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#d4a574',
                    marginBottom: '6px',
                  }}
                >
                  Visual comparison
                </div>
                <div
                  style={{
                    color: '#f4ead7',
                    fontSize: '1.02rem',
                  }}
                >
                  How the land looked before vs how it looks now
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'rgba(232, 225, 205, 0.68)',
                }}
              >
                Old image = baseline · New image = current
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '14px',
              }}
            >
              <ImageCard
                title={`Baseline image · ${result.date_before}`}
                subtitle="Satellite view from the older selected date."
                src={images.before}
                alt="Baseline satellite view"
                onErrorMessage="Baseline image failed to load."
              />

              <ImageCard
                title={`Current image · ${result.date_after}`}
                subtitle="Satellite view from the latest selected date."
                src={images.after}
                alt="Current satellite view"
                onErrorMessage="Current image failed to load."
              />
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(212,165,116,0.14)',
              padding: '14px',
              background:
                'linear-gradient(180deg, rgba(10,33,24,0.86) 0%, rgba(7,21,16,0.9) 100%)',
            }}
          >
            <div
              style={{
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '0.74rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#d4a574',
                  marginBottom: '6px',
                }}
              >
                Detected change
              </div>
              <div
                style={{
                  color: '#f4ead7',
                  fontSize: '1.02rem',
                }}
              >
                Red-highlighted pixels show where change was detected
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                minHeight: '420px',
                background: 'rgba(20, 34, 28, 0.9)',
                border: '1px solid rgba(232,188,135,0.18)',
                overflow: 'hidden',
              }}
            >
              {!overlayError && images.diff ? (
                <img
                  src={images.diff}
                  alt="Change overlay"
                  onError={() => setOverlayError(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '420px',
                    objectFit: 'contain',
                    display: 'block',
                    background: '#1b2621',
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: '420px',
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    padding: '1.25rem',
                    color: '#e8bc87',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Could not display change overlay
                    </strong>
                    <div>Overlay image failed to load.</div>
                  </div>
                </div>
              )}

              <div className="image-corners">
                <span className="corner tl" />
                <span className="corner tr" />
                <span className="corner bl" />
                <span className="corner br" />
              </div>
            </div>
          </div>

          {hasCropViews && (
            <div
              style={{
                border: '1px solid rgba(212,165,116,0.14)',
                padding: '14px',
                background:
                  'linear-gradient(180deg, rgba(10,33,24,0.86) 0%, rgba(7,21,16,0.9) 100%)',
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    fontSize: '0.74rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#d4a574',
                    marginBottom: '6px',
                  }}
                >
                  Changed area close-up
                </div>
                <div
                  style={{
                    color: '#f4ead7',
                    fontSize: '1.02rem',
                  }}
                >
                  Zoomed view of the detected changed zone
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '14px',
                }}
              >
                <ImageCard
                  title="Before crop"
                  subtitle="Older cropped image of the changed zone."
                  src={images.beforeCrop}
                  alt="Before cropped change zone"
                  onErrorMessage="Before crop failed to load."
                />

                <ImageCard
                  title="After crop"
                  subtitle="Latest cropped image of the changed zone."
                  src={images.afterCrop}
                  alt="After cropped change zone"
                  onErrorMessage="After crop failed to load."
                />

                <ImageCard
                  title="Overlay crop"
                  subtitle="Detected change highlighted in the cropped zone."
                  src={images.diffCrop}
                  alt="Overlay cropped change zone"
                  onErrorMessage="Overlay crop failed to load."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}