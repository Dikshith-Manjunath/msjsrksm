import React, { useState, useEffect } from 'react';
import { QuantitativeMetricsResponse, HourlyBoxPlot } from '../types';

interface RiskEvaluationProps {
  metrics: QuantitativeMetricsResponse | null;
  loading: boolean;
  startDate: string;
  endDate: string;
  onChangeDateRange: (start: string, end: string) => void;
  gateClosureHour: number;
  onChangeGateClosure: (h: number) => void;
  hoursFilter: 'all' | 'peak' | 'offpeak';
  onChangeHoursFilter: (f: 'all' | 'peak' | 'offpeak') => void;
  units: 'MW' | 'GW';
  onChangeUnits: (u: 'MW' | 'GW') => void;
}

export const RiskEvaluation: React.FC<RiskEvaluationProps> = ({
  metrics,
  loading,
  startDate,
  endDate,
  onChangeDateRange,
  gateClosureHour,
  onChangeGateClosure,
  hoursFilter,
  onChangeHoursFilter,
  units,
  onChangeUnits,
}) => {
  const [granularity, setGranularity] = useState<string>('month');

  // Format power values
  const fmtVal = (mw: number | null | undefined): string => {
    if (mw === null || mw === undefined) return '—';
    if (units === 'GW') {
      return (mw / 1000).toFixed(2) + ' GW';
    }
    return Math.round(mw).toLocaleString('en-GB') + ' MW';
  };

  const fmtSigned = (mw: number | null | undefined): string => {
    if (mw === null || mw === undefined) return '—';
    const s = mw > 0 ? '+' : '';
    if (units === 'GW') {
      return s + (mw / 1000).toFixed(2) + ' GW';
    }
    return s + Math.round(mw).toLocaleString('en-GB') + ' MW';
  };

  // Granularity selector changes date range
  const handleGranularity = (g: string) => {
    setGranularity(g);
    if (g === 'month') {
      onChangeDateRange('2026-01-01', '2026-01-31');
    } else if (g === 'w1') {
      onChangeDateRange('2026-01-01', '2026-01-07');
    } else if (g === 'w2') {
      onChangeDateRange('2026-01-08', '2026-01-14');
    } else if (g === 'w3') {
      onChangeDateRange('2026-01-15', '2026-01-21');
    } else if (g === 'w4') {
      onChangeDateRange('2026-01-22', '2026-01-28');
    }
  };

  // -----------------------------------------------------------
  // Histogram SVG Geometry (250 MW bins from -4000 to +4000 MW)
  // -----------------------------------------------------------
  const HW = 600;
  const HH = 320;
  const HL = 48;
  const HR = 16;
  const HT = 16;
  const HB = 34;
  const pw = HW - HL - HR;
  const ph = HH - HT - HB;

  const distBins = metrics?.error_distribution || [];
  // Filter for the middle 32 bins (-4000 to +4000 MW)
  const middleBins = distBins.filter((b) => b.bin_min >= -4000 && b.bin_max <= 4000);
  const maxBinCount = Math.max(5, ...middleBins.map((b) => b.count));
  const histYmax = Math.ceil((maxBinCount * 1.15) / 10) * 10 || 20;

  const nb = middleBins.length || 32;
  const hxOf = (k: number) => HL + (k * pw) / Math.max(1, nb);
  const hyOf = (c: number) => HT + ph * (1 - c / histYmax);

  // Normal PDF curve points
  const mean = metrics?.distribution_stats.mean_mw ?? 0;
  const sd = metrics?.distribution_stats.std_dev_mw ?? 1;
  const totalN = metrics?.total_evaluated_periods ?? 1;
  const binWidth = 250;

  const pdf = (x: number) => {
    if (sd === 0) return 0;
    return Math.exp(-Math.pow(x - mean, 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
  };

  const curvePts = [];
  for (let s = 0; s <= 80; s++) {
    const xv = -4000 + (s * 8000) / 80;
    const xp = HL + ((xv - -4000) / 8000) * pw;
    const expectedCount = totalN * binWidth * pdf(xv);
    curvePts.push(`${s ? 'L' : 'M'}${xp.toFixed(1)} ${hyOf(expectedCount).toFixed(1)}`);
  }

  // -----------------------------------------------------------
  // Box Plot SVG Geometry (24 Hours across selected range)
  // -----------------------------------------------------------
  const BW = 600;
  const BH = 320;
  const BL = 48;
  const BR = 14;
  const BT = 16;
  const BB = 32;
  const bpw = BW - BL - BR;
  const bph = BH - BT - BB;
  const colW = bpw / 24;
  const boxW = colW * 0.58;

  const boxPlots = metrics?.hourly_box_plots || [];
  // Calculate dynamic symmetric limit (e.g. ±3000 MW)
  let maxBoxVal = 1000;
  boxPlots.forEach((b) => {
    maxBoxVal = Math.max(maxBoxVal, Math.abs(b.whisker_low_mw), Math.abs(b.whisker_high_mw));
  });
  const boxLim = Math.ceil((maxBoxVal * 1.1) / 500) * 500;
  const byOf = (v: number) => BT + bph * (1 - (v + boxLim) / (2 * boxLim));
  const bxOf = (hour: number) => BL + (hour + 0.5) * colW;

  return (
    <section id="view-risk" style={{ marginTop: 12 }}>
      {/* Control Ribbon */}
      <div className="ctl" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {/* Date Range Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Evaluation Range (Jan 2026)</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={startDate}
              min="2026-01-01"
              max="2026-01-31"
              onChange={(e) => {
                setGranularity('custom');
                onChangeDateRange(e.target.value, endDate);
              }}
              className="btn"
              style={{ fontWeight: 600, padding: '4px 6px' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>to</span>
            <input
              type="date"
              value={endDate}
              min="2026-01-01"
              max="2026-01-31"
              onChange={(e) => {
                setGranularity('custom');
                onChangeDateRange(startDate, e.target.value);
              }}
              className="btn"
              style={{ fontWeight: 600, padding: '4px 6px' }}
            />
          </div>
        </div>

        {/* Granularity Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Granularity</span>
          <select
            value={granularity}
            onChange={(e) => handleGranularity(e.target.value)}
            className="btn"
            style={{ fontWeight: 600, padding: '5px 8px' }}
          >
            <option value="month">Full Month (Jan 1–31)</option>
            <option value="w1">Week 1 (Jan 1–7)</option>
            <option value="w2">Week 2 (Jan 8–14)</option>
            <option value="w3">Week 3 (Jan 15–21)</option>
            <option value="w4">Week 4 (Jan 22–28)</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Hours Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Hours Filter</span>
          <div style={{ display: 'flex', border: '1px solid var(--fg)' }}>
            <button
              className="btn"
              style={{
                background: hoursFilter === 'all' ? 'var(--fg)' : 'transparent',
                color: hoursFilter === 'all' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeHoursFilter('all')}
            >
              All (1-48 SP)
            </button>
            <button
              className="btn"
              style={{
                background: hoursFilter === 'peak' ? 'var(--fg)' : 'transparent',
                color: hoursFilter === 'peak' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeHoursFilter('peak')}
            >
              Peak 07–19
            </button>
            <button
              className="btn"
              style={{
                background: hoursFilter === 'offpeak' ? 'var(--fg)' : 'transparent',
                color: hoursFilter === 'offpeak' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeHoursFilter('offpeak')}
            >
              Off-Peak 19–07
            </button>
          </div>
        </div>

        {/* Gate Closure Cutoff Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Gate Closure (D-1)</span>
          <select
            value={gateClosureHour}
            onChange={(e) => onChangeGateClosure(Number(e.target.value))}
            className="btn"
            style={{ fontWeight: 600, padding: '5px 8px' }}
          >
            <option value={7}>07:00 GMT</option>
            <option value={9}>09:00 GMT</option>
            <option value={11}>11:00 GMT (GB Standard)</option>
            <option value={14}>14:00 GMT</option>
            <option value={18}>18:00 GMT</option>
          </select>
        </div>

        {/* Units Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 'auto' }}>
          <span className="ctl-label">Units</span>
          <div style={{ display: 'flex', border: '1px solid var(--fg)' }}>
            <button
              className="btn"
              style={{
                background: units === 'MW' ? 'var(--fg)' : 'transparent',
                color: units === 'MW' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeUnits('MW')}
            >
              MW
            </button>
            <button
              className="btn"
              style={{
                background: units === 'GW' ? 'var(--fg)' : 'transparent',
                color: units === 'GW' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeUnits('GW')}
            >
              GW
            </button>
          </div>
        </div>
      </div>

      {/* Scorecard Row (4 Key Risk Metrics) */}
      <div
        className="kpi"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {/* WAPE Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">WAPE (Weighted Abs Error)</span>
          <span className="cell-value" style={{ fontSize: 24, marginTop: 4 }}>
            {metrics ? `${metrics.wape_percent}%` : '—'}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            Total absolute miss / Total generation
          </span>
        </div>

        {/* Correlation R² Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">Correlation Coefficient R²</span>
          <span className="cell-value" style={{ fontSize: 24, marginTop: 4 }}>
            {metrics ? metrics.correlation_r2.toFixed(3) : '—'}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            1.0 = perfect tracking · 0.0 = uncorrelated
          </span>
        </div>

        {/* Systematic Bias Ratio Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">Systematic Bias Ratio</span>
          <span className="cell-value" style={{ fontSize: 18, marginTop: 4 }}>
            {metrics ? `${metrics.bias_ratio.pct_over_forecast}% Over · ${metrics.bias_ratio.pct_under_forecast}% Under` : '—'}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            MBE: {metrics ? fmtSigned(metrics.mean_bias_error_mw) : '—'}
          </span>
        </div>

        {/* Net Volumetric Imbalance Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">Net Volumetric Imbalance</span>
          <span className="cell-value" style={{ fontSize: 22, marginTop: 4 }}>
            {metrics ? `${metrics.net_imbalance_gwh > 0 ? '+' : ''}${metrics.net_imbalance_gwh.toLocaleString('en-GB')} GWh` : '—'}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            Cumulative energy delta over selected period
          </span>
        </div>
      </div>

      {/* Two-Column Analytics Charts Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Left Chart: Error Distribution Histogram */}
        <div style={{ border: '1px solid var(--line)', padding: 14, background: '#fff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--fg)',
              paddingBottom: 4,
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
              Forecast Error Distribution (250 MW Buckets)
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              Black curve = Fitted Gaussian
            </span>
          </div>

          <div style={{ position: 'relative', marginTop: 8 }}>
            <svg viewBox={`0 0 ${HW} ${HH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* Horizontal gridlines */}
              {[0, 1, 2, 3, 4].map((t) => {
                const v = (histYmax * t) / 4;
                const y = hyOf(v);
                return (
                  <g key={t}>
                    <line x1={HL} x2={HW - HR} y1={y} y2={y} stroke="#E4E4E4" strokeWidth="1" />
                    <text x={HL - 6} y={y + 4} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#666">
                      {Math.round(v)}
                    </text>
                  </g>
                );
              })}

              {/* Histogram Bars */}
              {middleBins.map((b, idx) => {
                const x0 = hxOf(idx);
                const bw = pw / nb;
                const y1 = hyOf(b.count);
                return (
                  <rect
                    key={idx}
                    x={(x0 + 1).toFixed(1)}
                    y={y1.toFixed(1)}
                    width={Math.max(1, bw - 2).toFixed(1)}
                    height={Math.max(0, HT + ph - y1).toFixed(1)}
                    fill="#D9D9D9"
                    stroke="#000"
                    strokeWidth="0.6"
                  />
                );
              })}

              {/* Fitted Normal Distribution Curve */}
              {curvePts.length > 0 && <path d={curvePts.join(' ')} fill="none" stroke="#000" strokeWidth="2" />}

              {/* X Axis Reference Labels */}
              {[-4000, -2000, 0, 2000, 4000].map((v) => {
                const xp = HL + ((v - -4000) / 8000) * pw;
                const anchor = v === -4000 ? 'start' : v === 4000 ? 'end' : 'middle';
                return (
                  <text
                    key={v}
                    x={xp}
                    y={HH - 10}
                    textAnchor={anchor}
                    fontSize={10}
                    fontFamily="var(--mono)"
                    fill="#333"
                  >
                    {v > 0 ? '+' : ''}
                    {v.toLocaleString('en-GB')}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Statistical Moments Summary Below Chart */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            <span>
              Mean: <strong style={{ color: '#000' }}>{metrics ? fmtSigned(metrics.distribution_stats.mean_mw) : '—'}</strong>
            </span>
            <span>
              Std Dev (σ):{' '}
              <strong style={{ color: '#000' }}>{metrics ? fmtVal(metrics.distribution_stats.std_dev_mw) : '—'}</strong>
            </span>
            <span>
              Excess Kurtosis:{' '}
              <strong style={{ color: '#000' }}>
                {metrics ? metrics.distribution_stats.excess_kurtosis.toFixed(2) : '—'}
              </strong>
            </span>
            <span>
              Beyond 2σ:{' '}
              <strong style={{ color: '#000' }}>
                {metrics ? `${metrics.distribution_stats.pct_beyond_2sigma}%` : '—'}
              </strong>{' '}
              {metrics && metrics.distribution_stats.pct_beyond_2sigma > 4.6 ? '(Fat tails detected)' : '(Normal tail)'}
            </span>
          </div>
        </div>

        {/* Right Chart: Hourly Error Box Plot */}
        <div style={{ border: '1px solid var(--line)', padding: 14, background: '#fff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--fg)',
              paddingBottom: 4,
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
              Hourly Error Spread (24 Hours GMT)
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              Box = IQR (50%) · Line = Median · Dots = Outliers
            </span>
          </div>

          <div style={{ position: 'relative', marginTop: 8 }}>
            <svg viewBox={`0 0 ${BW} ${BH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* Horizontal Gridlines */}
              {[-boxLim, -boxLim / 2, 0, boxLim / 2, boxLim].map((v) => {
                const y = byOf(v);
                return (
                  <g key={v}>
                    <line
                      x1={BL}
                      x2={BW - BR}
                      y1={y}
                      y2={y}
                      stroke={v === 0 ? '#000' : '#E4E4E4'}
                      strokeWidth={v === 0 ? '1.2' : '1'}
                    />
                    <text x={BL - 6} y={y + 4} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#666">
                      {v > 0 ? '+' : ''}
                      {Math.round(v).toLocaleString('en-GB')}
                    </text>
                  </g>
                );
              })}

              {/* 24 Hour Box Plots */}
              {boxPlots.map((bp) => {
                const xCenter = bxOf(bp.hour);
                const yQ1 = byOf(bp.q1_mw);
                const yMed = byOf(bp.median_mw);
                const yQ3 = byOf(bp.q3_mw);
                const yWLow = byOf(bp.whisker_low_mw);
                const yWHigh = byOf(bp.whisker_high_mw);

                return (
                  <g key={bp.hour}>
                    {/* Whisker Line */}
                    <line x1={xCenter} x2={xCenter} y1={yWLow} y2={yWHigh} stroke="#000" strokeWidth="1" />
                    <line x1={xCenter - 3} x2={xCenter + 3} y1={yWLow} y2={yWLow} stroke="#000" strokeWidth="1" />
                    <line x1={xCenter - 3} x2={xCenter + 3} y1={yWHigh} y2={yWHigh} stroke="#000" strokeWidth="1" />

                    {/* IQR Box (Q1 to Q3) */}
                    <rect
                      x={(xCenter - boxW / 2).toFixed(1)}
                      y={Math.min(yQ1, yQ3).toFixed(1)}
                      width={boxW.toFixed(1)}
                      height={Math.max(2, Math.abs(yQ3 - yQ1)).toFixed(1)}
                      fill="#EAEAEA"
                      stroke="#000"
                      strokeWidth="1"
                    />

                    {/* Median Line */}
                    <line
                      x1={(xCenter - boxW / 2).toFixed(1)}
                      x2={(xCenter + boxW / 2).toFixed(1)}
                      y1={yMed}
                      y2={yMed}
                      stroke="#000"
                      strokeWidth="2"
                    />

                    {/* Outlier Dots */}
                    {bp.outliers_mw.slice(0, 4).map((outlierVal, oIdx) => (
                      <circle key={oIdx} cx={xCenter} cy={byOf(outlierVal)} r="1.8" fill="#000" />
                    ))}
                  </g>
                );
              })}

              {/* X Axis Hour Labels (Every 3 Hours) */}
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <text
                  key={h}
                  x={bxOf(h)}
                  y={BH - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--mono)"
                  fill="#444"
                >
                  {String(h).padStart(2, '0')}:00
                </text>
              ))}
            </svg>
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            <span>Peak Period: 07:00–19:00 GMT</span>
            <span>Evaluated SPs: {metrics?.total_evaluated_periods ?? 0}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
