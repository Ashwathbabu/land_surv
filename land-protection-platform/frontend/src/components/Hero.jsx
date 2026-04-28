export default function Hero({ onStart }) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Phase 0 · Prototype · April 2026
          </div>

          <h1 className="hero-title">
            We watch the <em>land</em>
            <br />
            from <span className="accent-word">370 km above</span>.
          </h1>

          <p className="hero-lede">
            Draw a boundary on the map. TerraWatch pulls Sentinel-2
            imagery from two points in time, compares them pixel by
            pixel, and tells you what changed — deforestation,
            encroachment, construction, fire scars.
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary" onClick={onStart}>
              Begin an analysis
              <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                <path d="M1 5H17M17 5L13 1M17 5L13 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>Resolution</dt>
              <dd>10 m<span className="unit">/px</span></dd>
            </div>
            <div>
              <dt>Revisit</dt>
              <dd>5 <span className="unit">days</span></dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>Copernicus</dd>
            </div>
          </dl>
        </div>

        <div className="hero-right">
          <div className="satellite-card">
            <div className="card-header">
              <span className="card-id">SAT-001 · S2A</span>
              <span className="card-status">NOMINAL</span>
            </div>
            <SatelliteSVG />
            <div className="card-footer">
              <div>
                <span className="label">ALT</span>
                <span className="value">786 km</span>
              </div>
              <div>
                <span className="label">INC</span>
                <span className="value">98.62°</span>
              </div>
              <div>
                <span className="label">SWATH</span>
                <span className="value">290 km</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="how" className="how">
        <div className="section-head">
          <span className="section-num">§ 01</span>
          <h2>Three steps, nothing more.</h2>
        </div>
        <div className="steps">
          <Step
            num="I"
            title="Mark the land"
            body="Open the map. Draw a polygon around the parcel you want to protect — a farm, a forest patch, a conservation zone."
          />
          <Step
            num="II"
            title="Pick two dates"
            body="One from the past, one recent. TerraWatch fetches a cloud-masked Sentinel-2 composite around each."
          />
          <Step
            num="III"
            title="Read the change"
            body="We compute the pixel-wise difference, threshold it, and highlight exactly where the land has changed — with a severity read."
          />
        </div>
      </section>
    </section>
  );
}

function Step({ num, title, body }) {
  return (
    <article className="step">
      <span className="step-num">{num}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function SatelliteSVG() {
  return (
    <svg className="sat-svg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Earth */}
      <defs>
        <radialGradient id="earthGrad" cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#2d4a3a" />
          <stop offset="60%" stopColor="#1a3226" />
          <stop offset="100%" stopColor="#0d1f17" />
        </radialGradient>
        <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d4a574" stopOpacity="0" />
          <stop offset="50%" stopColor="#d4a574" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Stars */}
      {Array.from({ length: 30 }).map((_, i) => {
        const x = (i * 37) % 400;
        const y = (i * 53) % 300;
        const r = (i % 3 === 0 ? 1.2 : 0.6);
        return <circle key={i} cx={x} cy={y} r={r} fill="#d4a574" opacity={0.4} />;
      })}

      {/* Orbit ellipse */}
      <ellipse cx="200" cy="220" rx="180" ry="40" fill="none" stroke="url(#orbitGrad)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Earth */}
      <circle cx="200" cy="230" r="90" fill="url(#earthGrad)" />
      {/* Continents (abstract) */}
      <path d="M 140 220 Q 160 200, 180 210 T 220 215 Q 240 225, 250 240 Q 230 260, 200 258 Q 170 255, 150 240 Z" fill="#3d6049" opacity="0.8" />
      <path d="M 165 185 Q 185 178, 200 188 T 230 195 Q 215 210, 195 205 Q 175 200, 165 185 Z" fill="#3d6049" opacity="0.7" />

      {/* Satellite */}
      <g className="satellite-body" transform="translate(200, 80)">
        {/* Solar panels */}
        <rect x="-55" y="-8" width="30" height="16" fill="#0d1f17" stroke="#d4a574" strokeWidth="1" />
        <line x1="-50" y1="-8" x2="-50" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="-45" y1="-8" x2="-45" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="-40" y1="-8" x2="-40" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="-35" y1="-8" x2="-35" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="-30" y1="-8" x2="-30" y2="8" stroke="#d4a574" strokeWidth="0.5" />

        <rect x="25" y="-8" width="30" height="16" fill="#0d1f17" stroke="#d4a574" strokeWidth="1" />
        <line x1="30" y1="-8" x2="30" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="35" y1="-8" x2="35" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="40" y1="-8" x2="40" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="45" y1="-8" x2="45" y2="8" stroke="#d4a574" strokeWidth="0.5" />
        <line x1="50" y1="-8" x2="50" y2="8" stroke="#d4a574" strokeWidth="0.5" />

        {/* Body */}
        <rect x="-25" y="-12" width="50" height="24" fill="#1a3226" stroke="#d4a574" strokeWidth="1.2" rx="2" />
        <circle cx="0" cy="0" r="5" fill="#d4a574" />
        <circle cx="0" cy="0" r="2" fill="#0d1f17" />

        {/* Antenna */}
        <line x1="0" y1="-12" x2="0" y2="-20" stroke="#d4a574" strokeWidth="1" />
        <circle cx="0" cy="-22" r="2" fill="#d4a574" />
      </g>

      {/* Signal beam */}
      <g opacity="0.6">
        <line x1="200" y1="92" x2="190" y2="175" stroke="#d4a574" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="200" y1="92" x2="210" y2="175" stroke="#d4a574" strokeWidth="0.8" strokeDasharray="2 2" />
      </g>

      {/* Crosshairs */}
      <g stroke="#d4a574" strokeWidth="0.5" opacity="0.4">
        <line x1="20" y1="20" x2="40" y2="20" />
        <line x1="20" y1="20" x2="20" y2="40" />
        <line x1="380" y1="20" x2="360" y2="20" />
        <line x1="380" y1="20" x2="380" y2="40" />
        <line x1="20" y1="280" x2="40" y2="280" />
        <line x1="20" y1="280" x2="20" y2="260" />
        <line x1="380" y1="280" x2="360" y2="280" />
        <line x1="380" y1="280" x2="380" y2="260" />
      </g>
    </svg>
  );
}
