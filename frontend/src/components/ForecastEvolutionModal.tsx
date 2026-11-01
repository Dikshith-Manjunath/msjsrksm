import React, { useEffect, useState } from 'react';
import { AlignedPeriod, ForecastRevisionsResponse } from '../types';
import { fetchForecastRevisions } from '../api/client';

interface ForecastEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: AlignedPeriod | null;
  gateClosureCutoff: string;
  units: 'MW' | 'GW';
}

export const ForecastEvolutionModal: React.FC<ForecastEvolutionModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  gateClosureCutoff,
  units,
}) => {
  const [data, setData] = useState<ForecastRevisionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedPeriod) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchForecastRevisions(selectedPeriod.start_time, gateClosureCutoff)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load forecast run revisions');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedPeriod, gateClosureCutoff]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedPeriod) return null;

  const scale = units === 'GW' ? 0.001 : 1;
  const unitLabel = units;
  const actualMw = selectedPeriod.actual_mw;

  const fmtVal = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return (val * scale).toLocaleString('en-GB', {
      minimumFractionDigits: units === 'GW' ? 2 : 0,
      maximumFractionDigits: units === 'GW' ? 2 : 0,
    }) + ` ${unitLabel}`;
  };

  const fmtSigned = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    const scaled = val * scale;
    const sign = scaled > 0 ? '+' : '';
    return `${sign}${scaled.toLocaleString('en-GB', {
      minimumFractionDigits: units === 'GW' ? 2 : 0,
      maximumFractionDigits: units === 'GW' ? 2 : 0,
    })} ${unitLabel}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        style={{ maxWidth: 840, width: '92%', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ fontSize: 16 }}>
              Settlement Period {selectedPeriod.period_index} · Forecast Evolution & Convergence
            </h2>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)', marginTop: 4 }}>
              Target Delivery: {selectedPeriod.start_time.slice(0, 10)} {selectedPeriod.start_time.slice(11, 16)} GMT ·
              Actual Generation: <strong style={{ color: 'var(--fg)' }}>{fmtVal(actualMw)}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Narrative Banner */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Temporal Alignment & Lookahead Audit</div>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            This trace details every meteorological forecast published by Elexon for this target delivery window.
            In strict compliance with day-ahead trading rules, our engine evaluates the <strong>latest run published prior to {gateClosureCutoff.slice(11, 16)} GMT on D-1</strong>.
            Later intraday runs are tracked for convergence benchmarking but strictly quarantined from the day-ahead decision state.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>
            Querying historical forecast publications...
          </div>
        ) : error ? (
          <div style={{ padding: 20, color: 'red', fontFamily: 'var(--mono)', fontSize: 13 }}>{error}</div>
        ) : data ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--dim)',
                marginBottom: 8,
              }}
            >
              <span>{data.total_revisions} Historical Forecast Publications Tracked</span>
              <span>Gate Cutoff: {gateClosureCutoff}</span>
            </div>

            <div style={{ border: '1px solid var(--line)', maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--fg)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Publish Time (GMT)</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Decision State</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Forecast</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Delta to Actual</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Miss %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revisions.map((rev, idx) => {
                    const isLatestPrior =
                      rev.is_prior_to_cutoff &&
                      (idx === data.revisions.length - 1 || !data.revisions[idx + 1].is_prior_to_cutoff);

                    return (
                      <tr
                        key={rev.publish_time}
                        style={{
                          borderBottom: '1px solid var(--line)',
                          background: isLatestPrior
                            ? 'var(--surface-alt)'
                            : rev.is_prior_to_cutoff
                            ? 'transparent'
                            : 'transparent',
                          opacity: rev.is_prior_to_cutoff ? 1 : 0.65,
                          fontWeight: isLatestPrior ? 600 : 400,
                        }}
                      >
                        <td style={{ padding: '8px 10px' }}>
                          {rev.publish_time.replace('T', ' ').replace('Z', '')}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isLatestPrior ? (
                            <span
                              style={{
                                background: 'var(--fg)',
                                color: 'var(--bg)',
                                fontSize: 10,
                                padding: '2px 6px',
                                fontWeight: 700,
                              }}
                            >
                              USED AT GATE CLOSURE
                            </span>
                          ) : rev.is_prior_to_cutoff ? (
                            <span style={{ fontSize: 10, color: 'var(--dim)' }}>Prior Run</span>
                          ) : (
                            <span
                              style={{
                                border: '1px dashed var(--dim)',
                                fontSize: 10,
                                padding: '1px 5px',
                                color: 'var(--dim)',
                              }}
                            >
                              Post-Cutoff (Intraday)
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmtVal(rev.forecast_mw)}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '8px 10px',
                            color: 'var(--fg)',
                          }}
                        >
                          {fmtSigned(rev.error_mw)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--muted)' }}>
                          {rev.percentage_error !== null ? `${rev.percentage_error > 0 ? '+' : ''}${rev.percentage_error}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn solid" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
