import React, { useState, useEffect } from 'react';

interface FooterProps {
  pingMs: number | null;
  onNavigate: (tab: 'landing' | 'desk' | 'risk') => void;
}

export const Footer: React.FC<FooterProps> = ({ pingMs, onNavigate }) => {
  const [gmtClock, setGmtClock] = useState<string>('--:--:-- GMT');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setGmtClock(`${h}:${m}:${s} GMT`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="site-footer" style={{ borderTop: '1px solid var(--fg)', marginTop: 40 }}>
      <div className="wrap">
        <div className="footer-strip">
          {/* Column 1: Brand & Purpose */}
          <div className="fcell">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/platform-mark.svg" alt="" aria-hidden="true" style={{ width: 22, height: 22 }} />
              Wind Forecast Desk
            </h5>
            <p>Day-ahead wind forecast error for UK power trading, risk evaluation, and dispatch optimization.</p>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="fcell">
            <h5>Product</h5>
            <ul>
              <li>
                <a href="#features" onClick={() => onNavigate('landing')}>
                  Features
                </a>
              </li>
              <li>
                <a href="#views" onClick={() => onNavigate('landing')}>
                  Views
                </a>
              </li>
              <li>
                <a href="#method" onClick={() => onNavigate('landing')}>
                  Methodology
                </a>
              </li>
              <li>
                <a
                  href="#desk"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('desk');
                  }}
                  style={{ fontWeight: 600 }}
                >
                  Decision Desk →
                </a>
              </li>
              <li>
                <a
                  href="#risk"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('risk');
                  }}
                  style={{ fontWeight: 600 }}
                >
                  Risk & Evaluation →
                </a>
              </li>
              <li>
                <a href="/docs" target="_blank" rel="noreferrer">
                  OpenAPI Docs ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Market Parameters */}
          <div className="fcell">
            <h5>Market</h5>
            <p>UK EPEX SPOT GB DAM</p>
            <p style={{ marginTop: 6 }}>Settlement periods: 48 × 30 min</p>
            <p style={{ marginTop: 6 }}>Default gate cutoff: 11:00 GMT</p>
            <p style={{ marginTop: 6 }}>Dataset: January 2026 (Elexon BMRS)</p>
          </div>

          {/* Column 4: System Health & Clock */}
          <div className="fcell">
            <h5>System</h5>
            <p className="fmono">Latency {pingMs !== null ? `${pingMs} ms` : '...'}</p>
            <p className="fmono" style={{ marginTop: 6 }}>
              DB SQLite WAL (1,488 SPs)
            </p>
            <p className="fmono" style={{ marginTop: 6 }}>
              {gmtClock}
            </p>
          </div>
        </div>

        {/* Legal & Attribution Strip */}
        <div className="legal">
          <span>© 2026 Wind Forecast Desk // Day-Ahead Power Analytics</span>
          <span>Official UK National Generation & Forecast Feed (Elexon BMRS)</span>
        </div>
      </div>
    </footer>
  );
};
