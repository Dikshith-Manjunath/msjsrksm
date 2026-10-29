import React, { useState, useEffect } from 'react';
import { fetchMetrics } from '../api/client';
import { QuantitativeMetricsResponse } from '../types';

interface SensitivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryDate: string;
}

interface GateResult {
  hour: number;
  label: string;
  mae: number;
  rmse: number;
  bias: number;
  wape: number;
  imbalanceGwh: number;
}

export const SensitivityModal: React.FC<SensitivityModalProps> = ({ isOpen, onClose, deliveryDate }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<GateResult[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadComparison = async () => {
      setLoading(true);
      const gates = [
        { hour: 7, label: '07:00 GMT (-4h before gate)' },
        { hour: 9, label: '09:00 GMT (-2h before gate)' },
        { hour: 11, label: '11:00 GMT (EPEX Gate Closure)' },
        { hour: 14, label: '14:00 GMT (+3h intraday)' },
        { hour: 18, label: '18:00 GMT (+7h intraday)' },
      ];

      try {
        const promises = gates.map((g) =>
          fetchMetrics('2026-01-01', '2026-01-31', g.hour, 'half_hour', 'all').then((res) => ({
            hour: g.hour,
            label: g.label,
            mae: res.mae_mw,
            rmse: res.rmse_mw,
            bias: res.mean_bias_error_mw,
            wape: res.wape_percent,
            imbalanceGwh: res.net_imbalance_gwh,
          }))
        );

        const data = await Promise.all(promises);
        setResults(data);
      } catch (err) {
        console.error('Failed to load sensitivity data', err);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Gate-Closure Cutoff Sensitivity Matrix (January 2026)</h2>
          <button className="modal-close" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
          Comparing forecast accuracy across publication cutoffs demonstrates the value of later information states. Earlier cutoffs increase balancing risks; later intraday updates reduce volumetric error.
        </p>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>
            Calculating sensitivity across 1,488 settlement periods...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--fg)', background: 'var(--surface)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Cutoff Time</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>MAE</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>RMSE</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Mean Bias</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>WAPE</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Net Imbalance</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isStandard = r.hour === 11;
                return (
                  <tr
                    key={r.hour}
                    style={{
                      borderBottom: '1px solid var(--line)',
                      background: isStandard ? '#f5f5f5' : 'transparent',
                      fontWeight: isStandard ? 600 : 400,
                    }}
                  >
                    <td style={{ padding: '10px' }}>
                      {r.label} {isStandard && <span style={{ fontSize: 10, background: '#000', color: '#fff', padding: '1px 4px' }}>DEFAULT</span>}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px' }}>{Math.round(r.mae).toLocaleString()} MW</td>
                    <td style={{ textAlign: 'right', padding: '10px' }}>{Math.round(r.rmse).toLocaleString()} MW</td>
                    <td style={{ textAlign: 'right', padding: '10px', color: r.bias > 0 ? '#b30000' : '#0066cc' }}>
                      {r.bias > 0 ? '+' : ''}{Math.round(r.bias).toLocaleString()} MW
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px' }}>{r.wape.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', padding: '10px' }}>
                      {r.imbalanceGwh > 0 ? '+' : ''}{Math.round(r.imbalanceGwh).toLocaleString()} GWh
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} style={{ background: '#000', color: '#fff' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
