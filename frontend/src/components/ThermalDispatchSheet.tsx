import React, { useState, useMemo } from 'react';
import { AlignedPeriod } from '../types';

interface ThermalDispatchSheetProps {
  periods: AlignedPeriod[];
  cashoutPrice: number;
  units: 'MW' | 'GW';
  onInspectPeriod: (period: AlignedPeriod) => void;
}

interface BlockSummary {
  id: string;
  name: string;
  rangeStr: string;
  spRange: [number, number];
  avgForecastMw: number;
  avgActualMw: number;
  netShortfallMw: number;
  netThermalMwh: number;
  estimatedCostGbp: number;
  status: 'SHORTFALL' | 'SURPLUS' | 'BALANCED';
}

export const ThermalDispatchSheet: React.FC<ThermalDispatchSheetProps> = ({
  periods,
  cashoutPrice,
  units,
  onInspectPeriod,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'shortfall' | 'surplus'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const scale = units === 'GW' ? 0.001 : 1;
  const unitLabel = units;

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

  // Group periods into 5 standard UK electricity market blocks
  const blocks: BlockSummary[] = useMemo(() => {
    const definitions: Array<{ id: string; name: string; rangeStr: string; startSp: number; endSp: number }> = [
      { id: 'b1', name: 'Overnight Base', rangeStr: '00:00–07:00 GMT', startSp: 1, endSp: 14 },
      { id: 'b2', name: 'Morning Ramp', rangeStr: '07:00–09:00 GMT', startSp: 15, endSp: 18 },
      { id: 'b3', name: 'Midday Workday', rangeStr: '09:00–16:30 GMT', startSp: 19, endSp: 33 },
      { id: 'b4', name: 'Evening Peak', rangeStr: '16:30–19:30 GMT', startSp: 34, endSp: 39 },
      { id: 'b5', name: 'Night Taper', rangeStr: '19:30–24:00 GMT', startSp: 40, endSp: 48 },
    ];

    return definitions.map((def) => {
      const blockPeriods = periods.filter(
        (p) => p.period_index >= def.startSp && p.period_index <= def.endSp
      );
      if (blockPeriods.length === 0) {
        return {
          id: def.id,
          name: def.name,
          rangeStr: def.rangeStr,
          spRange: [def.startSp, def.endSp],
          avgForecastMw: 0,
          avgActualMw: 0,
          netShortfallMw: 0,
          netThermalMwh: 0,
          estimatedCostGbp: 0,
          status: 'BALANCED',
        };
      }

      const sumFc = blockPeriods.reduce((acc, p) => acc + (p.forecast_mw ?? 0), 0);
      const sumAct = blockPeriods.reduce((acc, p) => acc + (p.actual_mw ?? 0), 0);
      const avgFc = sumFc / blockPeriods.length;
      const avgAct = sumAct / blockPeriods.length;
      const netErr = avgFc - avgAct; // positive = over-forecast (shortfall)

      // Thermal procurement required is positive error (wind produced less than forecast)
      // Each SP is 0.5 hours
      const shortfallMwh = blockPeriods.reduce((acc, p) => {
        const err = (p.forecast_mw ?? 0) - (p.actual_mw ?? 0);
        return acc + (err > 0 ? err * 0.5 : 0);
      }, 0);

      const estimatedCost = Math.round(shortfallMwh * cashoutPrice);

      let status: 'SHORTFALL' | 'SURPLUS' | 'BALANCED' = 'BALANCED';
      if (netErr > 250) status = 'SHORTFALL';
      else if (netErr < -250) status = 'SURPLUS';

      return {
        id: def.id,
        name: def.name,
        rangeStr: def.rangeStr,
        spRange: [def.startSp, def.endSp],
        avgForecastMw: Math.round(avgFc),
        avgActualMw: Math.round(avgAct),
        netShortfallMw: Math.round(netErr),
        netThermalMwh: Math.round(shortfallMwh),
        estimatedCostGbp: estimatedCost,
        status,
      };
    });
  }, [periods, cashoutPrice]);

  // Filtered granular settlement periods
  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      const err = (p.forecast_mw ?? 0) - (p.actual_mw ?? 0);
      if (filterMode === 'shortfall') return err > 200;
      if (filterMode === 'surplus') return err < -200;
      return true;
    });
  }, [periods, filterMode]);

  // Export Dispatch Table to CSV
  const handleExportCSV = () => {
    const headers = [
      'Settlement_Period',
      'Start_Time_GMT',
      'Forecast_MW',
      'Actual_MW',
      'Error_MW',
      'Recommended_Action',
      'Thermal_Hedge_MWh',
      'Estimated_Cashout_GBP',
    ];

    const rows = periods.map((p) => {
      const err = (p.forecast_mw ?? 0) - (p.actual_mw ?? 0);
      const mwh = err > 0 ? (err * 0.5).toFixed(1) : '0';
      const cost = err > 0 ? Math.round(err * 0.5 * cashoutPrice) : 0;
      const action =
        err > 250
          ? 'PROCURE CCGT RESERVE'
          : err < -250
          ? 'TURN DOWN THERMAL'
          : 'BALANCED';

      return [
        p.period_index,
        p.start_time,
        p.forecast_mw ?? 0,
        p.actual_mw ?? 0,
        err,
        action,
        mwh,
        cost,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `thermal_dispatch_schedule_${periods[0]?.start_time.slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        marginTop: 24,
        border: '1px solid var(--fg)',
        background: 'var(--surface)',
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid var(--fg)',
          paddingBottom: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 14, textTransform: 'uppercase' }}>
              Thermal Procurement & Dispatch Sheet
            </h3>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--mono)',
                background: 'var(--fg)',
                color: 'var(--bg)',
                padding: '1px 6px',
                fontWeight: 700,
              }}
            >
              DAY-AHEAD ACTION PLAN
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Quantifies additional power procurement (CCGT / thermal reserve) required to hedge weather-dependent wind shortfall.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn"
            onClick={handleExportCSV}
            title="Download full 48-period dispatch schedule as CSV"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            ↓ Export Schedule (CSV)
          </button>
          <button
            className="btn ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ fontSize: 11, padding: '4px 8px', fontFamily: 'var(--mono)' }}
          >
            {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        </div>
      </div>

      {/* 5 Market Block Overview Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}
      >
        {blocks.map((b) => (
          <div
            key={b.id}
            style={{
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              padding: 12,
              borderLeft:
                b.status === 'SHORTFALL'
                  ? '3px solid var(--fg)'
                  : '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                {b.name}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--dim)' }}>
                {b.rangeStr}
              </span>
            </div>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                  padding: '1px 5px',
                  fontWeight: 700,
                  background: b.status === 'SHORTFALL' ? 'var(--fg)' : 'var(--surface)',
                  color: b.status === 'SHORTFALL' ? 'var(--bg)' : 'var(--fg)',
                  border: '1px solid var(--fg)',
                }}
              >
                {b.status === 'SHORTFALL'
                  ? 'PROCURE CCGT'
                  : b.status === 'SURPLUS'
                  ? 'BACK DOWN THERMAL'
                  : 'BALANCED'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                {b.netThermalMwh > 0 ? `${b.netThermalMwh.toLocaleString()} MWh` : '—'}
              </span>
            </div>

            <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Exposure:</span>
              <strong style={{ color: 'var(--fg)' }}>
                {b.estimatedCostGbp > 0 ? `£${b.estimatedCostGbp.toLocaleString()}` : '£0'}
              </strong>
            </div>
          </div>
        ))}
      </div>

      {/* Expandable Granular Settlement Period Table */}
      {isExpanded && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 8,
              fontSize: 12,
              fontFamily: 'var(--mono)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--dim)' }}>Filter Action:</span>
              <button
                className={`btn ${filterMode === 'all' ? 'solid' : 'ghost'}`}
                onClick={() => setFilterMode('all')}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                All Periods ({periods.length})
              </button>
              <button
                className={`btn ${filterMode === 'shortfall' ? 'solid' : 'ghost'}`}
                onClick={() => setFilterMode('shortfall')}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                Procure CCGT (Shortfall Only)
              </button>
              <button
                className={`btn ${filterMode === 'surplus' ? 'solid' : 'ghost'}`}
                onClick={() => setFilterMode('surplus')}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                Surplus Wind Only
              </button>
            </div>
            <span style={{ color: 'var(--dim)' }}>
              Click any row to inspect historical forecast convergence
            </span>
          </div>

          <div style={{ border: '1px solid var(--line)', maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--surface-alt)',
                    borderBottom: '1px solid var(--fg)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>SP</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>Time (GMT)</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px' }}>Wind Forecast</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px' }}>Wind Actual</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px' }}>Imbalance Delta</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>Dispatch Recommendation</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px' }}>Hedge Volume</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px' }}>Exposure (£)</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeriods.map((p) => {
                  const err = (p.forecast_mw ?? 0) - (p.actual_mw ?? 0);
                  const isShortfall = err > 200;
                  const isSurplus = err < -200;
                  const hedgeMwh = isShortfall ? Math.round(err * 0.5) : 0;
                  const expGbp = isShortfall ? Math.round(err * 0.5 * cashoutPrice) : 0;

                  return (
                    <tr
                      key={p.period_index}
                      onClick={() => onInspectPeriod(p)}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: isShortfall ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface-alt)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isShortfall ? 'rgba(0, 0, 0, 0.02)' : 'transparent';
                      }}
                      title="Click to view model run convergence ladder for this period"
                    >
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{p.period_index}</td>
                      <td style={{ padding: '6px 10px' }}>{p.start_time.slice(11, 16)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 10px' }}>{fmtVal(p.forecast_mw)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 10px' }}>{fmtVal(p.actual_mw)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--fg)', fontWeight: 600 }}>
                        {fmtSigned(err)}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {isShortfall ? (
                          <span
                            style={{
                              background: 'var(--fg)',
                              color: 'var(--bg)',
                              fontSize: 10,
                              padding: '1px 5px',
                              fontWeight: 700,
                            }}
                          >
                            PROCURE CCGT
                          </span>
                        ) : isSurplus ? (
                          <span style={{ border: '1px solid var(--dim)', color: 'var(--dim)', fontSize: 10, padding: '1px 5px' }}>
                            TURN DOWN THERMAL
                          </span>
                        ) : (
                          <span style={{ color: 'var(--dim)', fontSize: 10 }}>BALANCED</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 10px' }}>
                        {hedgeMwh > 0 ? `${hedgeMwh.toLocaleString()} MWh` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 10px' }}>
                        {expGbp > 0 ? `£${expGbp.toLocaleString()}` : '£0'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                        <span style={{ fontSize: 11, color: 'var(--fg)', textDecoration: 'underline' }}>
                          Trace →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
