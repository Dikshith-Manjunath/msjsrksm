import React, { useState } from 'react';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TourModal: React.FC<TourModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<number>(1);
  const totalSteps = 7;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            Product Primer <span>({String(step).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')})</span>
          </h2>
          <button className="modal-close" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Step Progress Bar */}
        <div style={{ height: 2, background: 'var(--line)', marginBottom: 16 }}>
          <div style={{ height: 2, background: '#000', width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {/* Step Contents */}
        {step === 1 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Welcome to Wind Forecast Desk</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              Decision-support intelligence for UK electricity utilities trading in the Day-Ahead wholesale market.
            </p>
            <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li>
                <strong>GB Day-Ahead Market:</strong> All decisions occur on Day D-1 before Gate Closure.
              </li>
              <li>
                <strong>Settlement Periods:</strong> 48 intervals per day (each 30 minutes in duration).
              </li>
              <li>
                <strong>Default Gate Closure:</strong> 11:00 GMT on D-1 (EPEX SPOT auction deadline).
              </li>
            </ul>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Target User Personas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <strong>Wholesale Power Trader:</strong> Primary user of the <em>Decision Desk</em>. Evaluates pre-bidding renewable exposure and sizes thermal power purchases.
              </div>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <strong>Dispatch Optimizer:</strong> Uses the desk to schedule flexible gas CCGT plants and battery storage around expected wind ramps.
              </div>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <strong>Quantitative Risk Analyst:</strong> Primary user of <em>Risk & Evaluation</em>. Evaluates model WAPE, $R^2$, and tail kurtosis over multi-day windows.
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Eliminating Lookahead Bias</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              Meteorological models publish forecast updates continuously throughout the day.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              When a trader submits bids at <strong>11:00 GMT on Day D-1</strong>, using a forecast published at 16:00 GMT on D-1 or on Day D is a form of <em>lookahead bias</em> (data leakage).
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, background: 'var(--surface)', padding: 10, borderLeft: '3px solid #000' }}>
              Our temporal engine strictly filters out all forecasts where <code>publishTime &gt; Cutoff</code>, accurately reproducing historical trader decision states.
            </p>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Live Elexon BMRS Architecture</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              The platform connects to the official Great Britain Balancing Mechanism Reporting Service (BMRS):
            </p>
            <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li>
                <strong>Actuals Feed:</strong> <code>FUELHH/stream</code> (fuelType = WIND)
              </li>
              <li>
                <strong>Forecast Feed:</strong> <code>WINDFOR/stream</code> (National Wind Generation Forecast)
              </li>
              <li>
                <strong>Local Storage:</strong> High-concurrency SQLite with Write-Ahead Logging (WAL) and memory mapping, providing sub-10ms query responses.
              </li>
            </ul>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Units & Resolutions</h3>
            <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li>
                <strong>48 SP · 30 min (Default):</strong> Standard UK settlement periods (SP 1 to 48). Hourly forecasts are linearly interpolated across the two 30-min periods.
              </li>
              <li>
                <strong>24 hr (Hourly Mode):</strong> Aggregates the two 30-minute actual readings to match the native 60-minute forecast resolution.
              </li>
              <li>
                <strong>MW / GW Units:</strong> Instant toggling between Megawatts and Gigawatts across all KPIs and exports.
              </li>
            </ul>
          </div>
        )}

        {step === 6 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Monochrome Chart Encoding Primer</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              Designed for high-contrast visibility on trading floors without distracting colors:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <span style={{ display: 'inline-block', width: 20, height: 3, background: '#000', marginRight: 8 }} />
                <strong>Actual Wind:</strong> Solid black curve
              </div>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <span style={{ display: 'inline-block', width: 20, height: 3, borderBottom: '2px dashed #666', marginRight: 8 }} />
                <strong>Forecast Wind:</strong> Dashed grey curve
              </div>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '1px solid #000', backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 4px)', marginRight: 8 }} />
                <strong>Over-forecast:</strong> Diagonal black hatching
              </div>
              <div style={{ border: '1px solid var(--line)', padding: 10 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, background: '#8F8F8F', marginRight: 8 }} />
                <strong>Under-forecast:</strong> Mid-grey solid fill
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Keyboard Shortcuts & Orientation</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Navigate like an expert power trader using dedicated hotkeys:
            </p>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 10 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', fontWeight: 600 }}>← / →</td>
                  <td>Previous or Next Delivery Day</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', fontWeight: 600 }}>T</td>
                  <td>Jump directly to Decision Desk</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', fontWeight: 600 }}>E</td>
                  <td>Copy current table to Clipboard as CSV</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', fontWeight: 600 }}>Esc</td>
                  <td>Exit Gate-Closure Preview Simulation</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <button className="btn" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step < totalSteps ? (
              <button className="btn" onClick={() => setStep(step + 1)}>
                Next Step →
              </button>
            ) : (
              <button className="btn" onClick={onClose} style={{ background: '#000', color: '#fff' }}>
                Open Decision Desk ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
