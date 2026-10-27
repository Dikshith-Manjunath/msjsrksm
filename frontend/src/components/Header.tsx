import React from 'react';
import { HealthStatus } from '../types';

interface HeaderProps {
  currentTab: 'landing' | 'desk' | 'risk';
  onSelectTab: (tab: 'landing' | 'desk' | 'risk') => void;
  health: HealthStatus | null;
  pingMs: number | null;
  onOpenTour: () => void;
  onOpenSensitivity: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  health,
  pingMs,
  onOpenTour,
  onOpenSensitivity,
  onTriggerSync,
  isSyncing,
}) => {
  return (
    <header className="topnav site-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <a
          href="#landing"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('landing');
          }}
          className="brand"
          style={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          GridBricks <span>// WindForecast OS</span>
        </a>
        <div className="tabs" role="tablist">
          <button
            className="tab"
            role="tab"
            aria-selected={currentTab === 'landing'}
            aria-current={currentTab === 'landing' ? 'page' : undefined}
            onClick={() => onSelectTab('landing')}
          >
            Overview
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={currentTab === 'desk'}
            aria-current={currentTab === 'desk' ? 'page' : undefined}
            onClick={() => onSelectTab('desk')}
          >
            Decision Desk
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={currentTab === 'risk'}
            aria-current={currentTab === 'risk' ? 'page' : undefined}
            onClick={() => onSelectTab('risk')}
          >
            Risk & Evaluation
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="health">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot" style={{ background: health?.status === 'online' ? '#000' : '#888' }} />
            Latency {pingMs !== null ? `${pingMs} ms` : '...'}
          </span>
          <span className="sep">|</span>
          <span>DB SQLite WAL</span>
          {health?.database.is_seeded && (
            <>
              <span className="sep">|</span>
              <span style={{ color: '#000', fontWeight: 600 }}>1,488 SPs</span>
            </>
          )}
        </div>

        <button
          className="btn ghost"
          onClick={onOpenSensitivity}
          title="Compare Cutoff Sensitivity (07:00 vs 09:00 vs 11:00 vs 14:00 vs 18:00)"
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          ⚡ Sensitivity
        </button>

        <button
          className="btn ghost"
          onClick={onOpenTour}
          title="Open Product Onboarding Guide & Market Primer"
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          (?) Tour
        </button>

        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="btn ghost"
          title="View FastAPI Swagger OpenAPI Documentation"
          style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
        >
          API Docs ↗
        </a>

        <button
          className="btn ghost"
          onClick={onTriggerSync}
          disabled={isSyncing}
          title="Sync latest live data from Elexon BMRS API"
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          {isSyncing ? 'Syncing...' : '🔄 Sync'}
        </button>
      </div>
    </header>
  );
};
