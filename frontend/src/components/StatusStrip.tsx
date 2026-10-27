import React, { useState, useEffect } from 'react';

interface StatusStripProps {
  deliveryDate: string;
  gateClosureHour: number;
}

export const StatusStrip: React.FC<StatusStripProps> = ({ deliveryDate, gateClosureHour }) => {
  const [gmtClock, setGmtClock] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setGmtClock(`${h}:${m}:${s} GMT`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format delivery date nicely (e.g. Thu 15 Jan 2026)
  const formatDeliveryDate = (dStr: string) => {
    try {
      const d = new Date(`${dStr}T00:00:00Z`);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dStr;
    }
  };

  // Format cutoff date (Day D-1 at gateClosureHour:00 GMT)
  const formatCutoffDate = (dStr: string, gh: number) => {
    try {
      const d = new Date(`${dStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const dayFormatted = d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return `${dayFormatted} · ${String(gh).padStart(2, '0')}:00 GMT`;
    } catch {
      return `D-1 · ${gh}:00 GMT`;
    }
  };

  return (
    <div className="status-strip">
      <div className="cell">
        <span className="cell-label">Market</span>
        <span className="cell-value">
          <span className="pulse-dot" style={{ marginRight: 6 }} />
          UK EPEX SPOT GB DAM
        </span>
      </div>

      <div className="cell">
        <span className="cell-label">Delivery</span>
        <span className="cell-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {formatDeliveryDate(deliveryDate)}
          <span className="live-pill">
            <span className="green-dot" /> LIVE BMRS
          </span>
        </span>
      </div>

      <div className="cell">
        <span className="cell-label">Bidding cutoff</span>
        <span className="cell-value">{formatCutoffDate(deliveryDate, gateClosureHour)}</span>
      </div>

      <div className="cell clock-cell">
        <span className="cell-label">Settlement clock (GMT)</span>
        <span className="cell-value">{gmtClock}</span>
      </div>
    </div>
  );
};
