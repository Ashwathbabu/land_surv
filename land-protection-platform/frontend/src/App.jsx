import { useState, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import Workspace from './components/Workspace.jsx';
import History from './components/History.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const [view, setView] = useState('home'); // home | workspace | history
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: 'offline' }));
  }, []);

  return (
    <div className="app-shell">
      <Nav view={view} setView={setView} status={status} />
      <main>
        {view === 'home' && <Hero onStart={() => setView('workspace')} />}
        {view === 'workspace' && <Workspace />}
        {view === 'history' && <History />}
      </main>
      <Footer />
    </div>
  );
}

function Nav({ view, setView, status }) {
  const modeLabel = status?.gee ? 'LIVE · SENTINEL-2' : 'DEMO MODE';
  const modeClass = status?.gee ? 'mode-live' : 'mode-demo';

  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="nav-brand" onClick={() => setView('home')}>
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.2" />
            <line x1="16" y1="26" x2="16" y2="30" stroke="currentColor" strokeWidth="1.2" />
            <line x1="2" y1="16" x2="6" y2="16" stroke="currentColor" strokeWidth="1.2" />
            <line x1="26" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <div className="brand-text">
            <span className="brand-mark">TERRAWATCH</span>
            <span className="brand-sub">Land Protection · Phase 0</span>
          </div>
        </div>
        <nav className="nav-links">
          <button
            className={view === 'workspace' ? 'active' : ''}
            onClick={() => setView('workspace')}
          >
            <span className="num">01</span> Analyze
          </button>
          <button
            className={view === 'history' ? 'active' : ''}
            onClick={() => setView('history')}
          >
            <span className="num">02</span> History
          </button>
          <span className={`mode-badge ${modeClass}`}>
            <span className="pulse" />
            {modeLabel}
          </span>
        </nav>
      </div>
    </header>
  );
}
