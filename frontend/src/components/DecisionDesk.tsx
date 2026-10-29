import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlignedPeriod, DayAheadForecastResponse } from '../types';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';

interface DecisionDeskProps {
  data: DayAheadForecastResponse | null;
  loading: boolean;
  deliveryDate: string;
  onChangeDate: (date: string) => void;
  gateClosureHour: number;
  onChangeGateClosure: (hour: number) => void;
  resolution: 'half_hour' | 'hour';
  onChangeResolution: (res: 'half_hour' | 'hour') => void;
  units: 'MW' | 'GW';
  onChangeUnits: (u: 'MW' | 'GW') => void;
  allDates: string[];
}

export const DecisionDesk: React.FC<DecisionDeskProps> = ({
  data,
  loading,
  deliveryDate,
  onChangeDate,
  gateClosureHour,
  onChangeGateClosure,
  resolution,
  onChangeResolution,
  units,
  onChangeUnits,
  allDates,
}) => {
  // Gate Simulator State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewGate, setPreviewGate] = useState<number | null>(null);
  const playTimerRef = useRef<number | null>(null);

  // Cashout price setting (£/MWh)
  const [cashoutPrice, setCashoutPrice] = useState<number>(75);

  // Smooth sliding positions (continuous float 0..100)
  const [continuousGateVal, setContinuousGateVal] = useState<number>(
    () => {
      const idx = [7, 9, 11, 14, 18].indexOf(gateClosureHour);
      return idx >= 0 ? (idx / 4) * 100 : 50;
    }
  );
  const [continuousScrubVal, setContinuousScrubVal] = useState<number>(
    () => {
      const idx = [6, 9, 11, 15].indexOf(previewGate !== null ? previewGate : 11);
      return idx >= 0 ? (idx / 3) * 100 : 66.6;
    }
  );

  // Keep continuous positions synced when external props change
  useEffect(() => {
    const idx = [7, 9, 11, 14, 18].indexOf(gateClosureHour);
    if (idx >= 0) {
      setContinuousGateVal((idx / 4) * 100);
    }
  }, [gateClosureHour]);

  useEffect(() => {
    const target = previewGate !== null ? previewGate : 11;
    const idx = [6, 9, 11, 15].indexOf(target);
    if (idx >= 0) {
      setContinuousScrubVal((idx / 3) * 100);
    }
  }, [previewGate]);

  // Hover crosshair state for hero chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Status message for export
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // Calendar popover open state
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  // Close calendar popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCalendarOpen]);

  // Insights toggle on narrow screens
  const [showInsights, setShowInsights] = useState<boolean>(true);

  const activeGate = previewGate !== null ? previewGate : gateClosureHour;

  // Format power values according to MW/GW
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

  // Day Navigation
  const currentIndex = allDates.indexOf(deliveryDate);
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < allDates.length - 1;

  const handlePrevDay = () => {
    if (canPrev) onChangeDate(allDates[currentIndex - 1]);
  };

  const handleNextDay = () => {
    if (canNext) onChangeDate(allDates[currentIndex + 1]);
  };

  // Simulator playback loop (06:00, 09:00, 11:00, 15:00)
  const simSteps = [6, 9, 11, 15];
  const togglePlay = () => {
    if (isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      let stepIdx = 0;
      setPreviewGate(simSteps[stepIdx]);
      playTimerRef.current = window.setInterval(() => {
        stepIdx = (stepIdx + 1) % simSteps.length;
        setPreviewGate(simSteps[stepIdx]);
      }, 1400);
    }
  };

  const exitPreview = () => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    setIsPlaying(false);
    setPreviewGate(null);
  };

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, []);

  // Compute desk metrics over active periods
  const periods = data?.periods || [];
  const metrics = useMemo(() => {
    const valid = periods.filter((p) => p.actual_mw !== null && p.forecast_mw !== null);
    if (!valid.length) return null;

    const errs = valid.map((p) => p.error_mw!);
    const absErrs = valid.map((p) => Math.abs(p.error_mw!));
    const mae = absErrs.reduce((a, b) => a + b, 0) / valid.length;
    const rmse = Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / valid.length);
    const mbe = errs.reduce((a, b) => a + b, 0) / valid.length;

    let maxAbs = -1;
    let maxP: AlignedPeriod = valid[0];
    valid.forEach((p) => {
      if (Math.abs(p.error_mw!) > maxAbs) {
        maxAbs = Math.abs(p.error_mw!);
        maxP = p;
      }
    });

    // Thermal energy needed in MWh = sum of over-forecasts (where utility must procure replacement)
    // Or net bias volume: MBE * 24 hours
    const netMWhNeeded = Math.max(0, mbe * 24);
    const estimatedCostGbp = Math.round(netMWhNeeded * cashoutPrice);

    return { mae, rmse, mbe, maxP, netMWhNeeded, estimatedCostGbp };
  }, [periods, cashoutPrice]);

  // Export handlers
  const handleCopy = (type: 'csv' | 'json') => {
    if (!periods.length) return;
    let text = '';
    if (type === 'csv') {
      const header = 'Period,StartTime,Actual_MW,Forecast_MW,Error_MW,PublishTime\n';
      const rows = periods
        .map(
          (p) =>
            `${p.period_index},"${p.start_time}",${p.actual_mw ?? ''},${p.forecast_mw ?? ''},${p.error_mw ?? ''},"${p.publish_time_used ?? ''}"`
        )
        .join('\n');
      text = header + rows;
    } else {
      text = JSON.stringify(periods, null, 2);
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyMsg(`Copied ${type.toUpperCase()} table to clipboard!`);
        setTimeout(() => setCopyMsg(null), 3000);
      })
      .catch(() => {
        setCopyMsg(`Clipboard error. Please try Download.`);
        setTimeout(() => setCopyMsg(null), 3000);
      });
  };

  const handleDownload = (type: 'csv' | 'json') => {
    if (!periods.length) return;
    let content = '';
    let mime = '';
    let filename = `WindForecast_${deliveryDate}_Gate${activeGate}h.${type}`;

    if (type === 'csv') {
      const header = 'Period,StartTime,Actual_MW,Forecast_MW,Error_MW,PublishTime\n';
      const rows = periods
        .map(
          (p) =>
            `${p.period_index},"${p.start_time}",${p.actual_mw ?? ''},${p.forecast_mw ?? ''},${p.error_mw ?? ''},"${p.publish_time_used ?? ''}"`
        )
        .join('\n');
      content = header + rows;
      mime = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify(data, null, 2);
      mime = 'application/json;charset=utf-8;';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Geometry
  const W = 1000;
  const H = 340;
  const PL = 60;
  const PR = 20;
  const PT = 24;
  const PB = 34;
  const PW = W - PL - PR;
  const PH = H - PT - PB;

  const n = periods.length || 48;
  const actuals = periods.map((p) => p.actual_mw ?? 0);
  const forecasts = periods.map((p) => p.forecast_mw ?? 0);
  const maxVal = Math.max(1000, ...actuals, ...forecasts);
  const ymax = Math.ceil((maxVal * 1.1) / 2000) * 2000;

  const xOf = (i: number) => PL + (i * PW) / Math.max(1, n - 1);
  const yOf = (v: number) => PT + PH * (1 - v / ymax);

  // Ramp and Peak vertical reference lines
  const rampIdx = resolution === 'half_hour' ? 14 : 7; // 07:00
  const peakIdx = resolution === 'half_hour' ? 36 : 18; // 18:00

  // Errors chart geometry
  const EH = 220;
  const EPT = 14;
  const EPB = 26;
  const EPH = EH - EPT - EPB;
  const errors = periods.map((p) => (p.forecast_mw ?? 0) - (p.actual_mw ?? 0));
  const maxAbsErr = Math.max(1000, ...errors.map(Math.abs));
  const emax = Math.max(1500, Math.ceil((maxAbsErr * 1.15) / 500) * 500);
  const eyOf = (v: number) => EPT + EPH / 2 - (v / emax) * (EPH / 2);
  const bw = Math.max(3, (PW / n) * 0.62);

  // Time labels
  const timeLabels = resolution === 'half_hour' ? [0, 12, 24, 36, 47] : [0, 6, 12, 18, 23];
  const getTimeStr = (idx: number) => {
    if (resolution === 'half_hour') {
      const totM = idx * 30;
      const h = Math.floor(totM / 60);
      const m = totM % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return `${String(idx).padStart(2, '0')}:00`;
  };

  return (
    <section id="view-desk" style={{ marginTop: 12 }}>
      {/* Keyboard Shortcuts Bar */}
      <div className="kbd" style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 12 }}>
        Key shortcuts: <strong>← / →</strong> day · <strong>T</strong> desk · <strong>E</strong> export · <strong>Esc</strong> exit preview
      </div>

      {/* Control Ribbon */}
      <div className="ctl" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {/* Delivery Day Picker with React DayPicker Popover */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Delivery Day</span>
          <div className="date-row" style={{ display: 'flex', gap: 4, alignItems: 'stretch', position: 'relative' }}>
            <button
              className="btn"
              onClick={handlePrevDay}
              disabled={!canPrev}
              title="Previous Day"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, padding: '0 12px' }}
            >
              ← Prev
            </button>

            {/* Interactive Calendar Button */}
            <div ref={calendarRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                title="Open Calendar Date Picker"
                style={{
                  fontWeight: 600,
                  height: 36,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--mono)',
                  background: isCalendarOpen ? 'var(--surface)' : 'var(--bg)',
                }}
              >
                <span>{deliveryDate}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{isCalendarOpen ? '▲' : '▼'}</span>
              </button>

              {/* DayPicker Floating Popover */}
              {isCalendarOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 200,
                    background: '#FFFFFF',
                    border: '1px solid #000000',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                    borderRadius: 4,
                  }}
                >
                  <Calendar
                    mode="single"
                    selected={new Date(`${deliveryDate}T12:00:00`)}
                    onSelect={(d) => {
                      if (d) {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const dateStr = `${y}-${m}-${day}`;
                        // Only select if it is one of the valid dates
                        if (allDates.includes(dateStr)) {
                          onChangeDate(dateStr);
                          setIsCalendarOpen(false);
                        }
                      }
                    }}
                    defaultMonth={new Date(2026, 0, 15)}
                    disabled={(date) => {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const str = `${y}-${m}-${day}`;
                      // Grey out all dates that don't have available data
                      return !allDates.includes(str);
                    }}
                  />
                  <div
                    style={{
                      borderTop: '1px solid var(--line)',
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11,
                      fontFamily: 'var(--mono)',
                      color: 'var(--dim)',
                    }}
                  >
                    <span>January 2026 Dataset</span>
                    <button
                      className="btn ghost"
                      style={{ fontSize: 11, padding: 0 }}
                      onClick={() => setIsCalendarOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className="btn"
              onClick={handleNextDay}
              disabled={!canNext}
              title="Next Day"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, padding: '0 12px' }}
            >
              Next →
            </button>
            <button
              className="btn ghost"
              onClick={() => onChangeDate('2026-01-15')}
              disabled={deliveryDate === '2026-01-15'}
              style={{ height: 36, display: 'inline-flex', alignItems: 'center' }}
            >
              Today
            </button>
          </div>
        </div>

        {/* Gate Closure Cutoff Slider */}
        <div className="gate" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="ctl-label">Gate Closure Cutoff (D-1)</span>
            <span className="gate-value" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
              {String(activeGate).padStart(2, '0')}:00 GMT {activeGate === 11 ? '(standard)' : ''}
            </span>
          </div>
          <div style={{ width: 190, paddingTop: 2 }}>
            <Slider
              min={0}
              max={100}
              step={0.5}
              value={continuousGateVal}
              onValueChange={(val) => {
                const numeric = Array.isArray(val) ? val[0] : val;
                setContinuousGateVal(numeric);
                // Threshold-based responsive quantization across 5 gates: [7, 9, 11, 14, 18]
                // Buckets centered at 0%, 25%, 50%, 75%, 100% (thresholds at 12.5%, 37.5%, 62.5%, 87.5%)
                const gates = [7, 9, 11, 14, 18];
                let chosenIdx = 0;
                if (numeric >= 87.5) chosenIdx = 4;
                else if (numeric >= 62.5) chosenIdx = 3;
                else if (numeric >= 37.5) chosenIdx = 2;
                else if (numeric >= 12.5) chosenIdx = 1;
                else chosenIdx = 0;

                if (gates[chosenIdx] !== activeGate) {
                  onChangeGateClosure(gates[chosenIdx]);
                }
              }}
            />
          </div>
        </div>

        {/* Resolution Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ctl-label">Resolution</span>
          <div style={{ display: 'flex', border: '1px solid var(--fg)' }}>
            <button
              className="btn"
              style={{
                background: resolution === 'half_hour' ? 'var(--fg)' : 'transparent',
                color: resolution === 'half_hour' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeResolution('half_hour')}
            >
              48 SP · 30m
            </button>
            <button
              className="btn"
              style={{
                background: resolution === 'hour' ? 'var(--fg)' : 'transparent',
                color: resolution === 'hour' ? 'var(--bg)' : 'var(--fg)',
                border: 0,
              }}
              onClick={() => onChangeResolution('hour')}
            >
              24 hr
            </button>
          </div>
        </div>

        {/* Units Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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

        {/* Export Buttons */}
        <div className="export" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 'auto' }}>
          <span className="ctl-label">Export Data</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => handleCopy('csv')} title="Copy Table to Clipboard">
              Copy CSV
            </button>
            <button className="btn" onClick={() => handleDownload('csv')} title="Download CSV File">
              ↓ CSV
            </button>
            <button className="btn" onClick={() => handleDownload('json')} title="Download JSON File">
              ↓ JSON
            </button>
          </div>
          {copyMsg && (
            <span className="copy-msg" style={{ fontSize: 11, color: '#000', fontWeight: 600 }}>
              {copyMsg}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Row (4 Core Cards + 1 Financial Hedge Estimator Card) */}
      <div
        className="kpi"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {/* MAE Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">MAE (Mean Absolute Error)</span>
          <span className="cell-value" style={{ fontSize: 22, marginTop: 4 }}>
            {fmtVal(metrics?.mae)}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)' }}>
            Average volume miss per period
          </span>
        </div>

        {/* RMSE Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">RMSE (Root Mean Square)</span>
          <span className="cell-value" style={{ fontSize: 22, marginTop: 4 }}>
            {fmtVal(metrics?.rmse)}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)' }}>
            Penalizes steep ramp/drop swings
          </span>
        </div>

        {/* Mean Bias Error Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">Mean Bias Error</span>
          <span className="cell-value" style={{ fontSize: 22, marginTop: 4 }}>
            {fmtSigned(metrics?.mbe)}
          </span>
          <div style={{ marginTop: 6 }}>
            {metrics?.mbe !== undefined && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                  padding: '2px 6px',
                  background: Math.abs(metrics.mbe) > 500 ? '#000' : 'var(--surface)',
                  color: Math.abs(metrics.mbe) > 500 ? '#fff' : '#000',
                  border: '1px solid var(--fg)',
                  fontWeight: 600,
                }}
              >
                {metrics.mbe > 0
                  ? `Hedge: procure +${Math.round(metrics.mbe / 10) * 10} MW thermal`
                  : `Hedge: sell back about ${Math.abs(Math.round(metrics.mbe / 10) * 10)} MW`}
              </span>
            )}
          </div>
        </div>

        {/* Max Imbalance Card */}
        <div className="cell" style={{ padding: 14 }}>
          <span className="kpi-label">Max Imbalance Exposure</span>
          <span className="cell-value" style={{ fontSize: 20, marginTop: 4 }}>
            {metrics?.maxP ? fmtSigned(metrics.maxP.error_mw) : '—'}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            {metrics?.maxP ? `SP ${metrics.maxP.period_index} @ ${metrics.maxP.start_time.slice(11, 16)} GMT` : '—'}
          </span>
        </div>

        {/* NEW: Financial Thermal Hedge & Cashout Estimator Card */}
        <div className="cell card-cost" style={{ padding: 14, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label" style={{ fontWeight: 700 }}>
              Thermal Hedge & Cashout Risk
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>Price £/MWh:</span>
              <input
                type="number"
                value={cashoutPrice}
                onChange={(e) => setCashoutPrice(Number(e.target.value) || 0)}
                style={{ width: 44, fontSize: 11, fontFamily: 'var(--mono)', padding: '1px 3px', border: '1px solid #000' }}
              />
            </div>
          </div>
          <span className="cell-value" style={{ fontSize: 20, marginTop: 4, color: '#000' }}>
            £{(metrics?.estimatedCostGbp || 0).toLocaleString('en-GB')}
          </span>
          <span className="kpi-sub" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
            Req: ~{Math.round(metrics?.netMWhNeeded || 0).toLocaleString()} MWh thermal reserve
          </span>
        </div>
      </div>

      {/* Gate Closure Simulator Bar */}
      <div
        className="gate-sim"
        style={{
          marginTop: 16,
          padding: '8px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <button className="btn" onClick={togglePlay} style={{ fontWeight: 600 }}>
          {isPlaying ? '❚❚ Pause' : '▶ Simulate Gate Closure'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Scrubber:</span>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Slider
              min={0}
              max={100}
              step={0.5}
              value={continuousScrubVal}
              onValueChange={(val) => {
                if (isPlaying) togglePlay();
                const numeric = Array.isArray(val) ? val[0] : val;
                setContinuousScrubVal(numeric);
                // Threshold-based responsive quantization across 4 simSteps: [6, 9, 11, 15]
                // Buckets centered at 0%, 33.3%, 66.6%, 100% (thresholds at 16.6%, 50%, 83.3%)
                let chosenIdx = 0;
                if (numeric >= 83.3) chosenIdx = 3;
                else if (numeric >= 50.0) chosenIdx = 2;
                else if (numeric >= 16.6) chosenIdx = 1;
                else chosenIdx = 0;

                if (simSteps[chosenIdx] !== previewGate) {
                  setPreviewGate(simSteps[chosenIdx]);
                }
              }}
            />
          </div>
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          {previewGate !== null ? (
            <span style={{ color: '#000', fontWeight: 600 }}>
              Previewing cutoff: {String(previewGate).padStart(2, '0')}:00 GMT
            </span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>Live gate: {gateClosureHour}:00 GMT</span>
          )}
        </div>

        {previewGate !== null && (
          <button className="btn ghost" onClick={exitPreview} style={{ fontSize: 11, padding: '2px 8px' }}>
            Exit preview
          </button>
        )}
      </div>

      {/* Main Chart + Insights Row */}
      <div
        className="hero-row"
        style={{
          display: 'grid',
          gridTemplateColumns: showInsights ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)',
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Left Column: Hero Chart & Settlement Error Bar Chart */}
        <div>
          {/* Chart Header & Legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--fg)',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
              GB National Wind Generation: Actual vs Day-Ahead Forecast
            </span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: 'var(--mono)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 2, background: '#000', display: 'inline-block' }} /> Actual
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 2, borderBottom: '2px dashed #666', display: 'inline-block' }} /> Forecast
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 12,
                    height: 10,
                    border: '1px solid #000',
                    backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 4px)',
                    display: 'inline-block',
                  }}
                />{' '}
                Over-forecast
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 10, background: '#8F8F8F', display: 'inline-block' }} /> Under-forecast
              </span>
            </div>
          </div>

          {/* SVG Hero Chart */}
          <div className="chart-wrap" style={{ position: 'relative', marginTop: 10 }}>
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
              >
                Fetching Elexon streams...
              </div>
            )}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: 'auto', display: 'block', background: '#fff' }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * W;
                if (mouseX >= PL && mouseX <= W - PR) {
                  const idx = Math.round(((mouseX - PL) / PW) * (n - 1));
                  setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="1.2" />
                </pattern>
              </defs>

              {/* Y Axis Gridlines and Labels */}
              {[0, 1, 2, 3, 4].map((k) => {
                const v = (ymax * k) / 4;
                const y = yOf(v);
                return (
                  <g key={k}>
                    <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="#E4E4E4" strokeWidth="1" />
                    <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fontFamily="var(--mono)" fill="#666">
                      {fmtVal(v)}
                    </text>
                  </g>
                );
              })}

              {/* Ramp & Peak Reference Lines */}
              <line
                x1={xOf(rampIdx)}
                x2={xOf(rampIdx)}
                y1={PT}
                y2={PT + PH}
                stroke="#B0B0B0"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              <text x={xOf(rampIdx) + 4} y={PT + 12} fontSize={10} fontFamily="var(--mono)" fill="#767676">
                Morning ramp 07:00
              </text>

              <line
                x1={xOf(peakIdx)}
                x2={xOf(peakIdx)}
                y1={PT}
                y2={PT + PH}
                stroke="#B0B0B0"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              <text x={xOf(peakIdx) + 4} y={PT + 12} fontSize={10} fontFamily="var(--mono)" fill="#767676">
                Evening peak 18:00
              </text>

              {/* Shaded Areas Between Forecast and Actual */}
              {periods.slice(0, -1).map((p, i) => {
                const f0 = p.forecast_mw ?? 0;
                const f1 = periods[i + 1]?.forecast_mw ?? f0;
                const a0 = p.actual_mw ?? 0;
                const a1 = periods[i + 1]?.actual_mw ?? a0;
                const isOver = (f0 + f1) / 2 > (a0 + a1) / 2;
                const pts = `${xOf(i)},${yOf(f0)} ${xOf(i + 1)},${yOf(f1)} ${xOf(i + 1)},${yOf(a1)} ${xOf(i)},${yOf(a0)}`;
                return <polygon key={i} points={pts} fill={isOver ? 'url(#hatch)' : '#8F8F8F'} />;
              })}

              {/* Forecast Dashed Line */}
              <path
                d={periods.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(p.forecast_mw ?? 0).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="#555"
                strokeWidth="1.8"
                strokeDasharray="6 4"
              />

              {/* Actual Solid Line */}
              <path
                d={periods.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(p.actual_mw ?? 0).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="#000"
                strokeWidth="2.4"
              />

              {/* X Axis Time Labels */}
              {timeLabels.map((idx) => {
                const anchor = idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle';
                return (
                  <text
                    key={idx}
                    x={xOf(idx)}
                    y={H - 8}
                    textAnchor={anchor}
                    fontSize={11}
                    fontFamily="var(--mono)"
                    fill="#444"
                  >
                    {getTimeStr(idx)}
                  </text>
                );
              })}

              {/* Hover Crosshair & Circles */}
              {hoverIndex !== null && periods[hoverIndex] && (
                <g>
                  <line
                    x1={xOf(hoverIndex)}
                    x2={xOf(hoverIndex)}
                    y1={PT}
                    y2={PT + PH}
                    stroke="#000"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={xOf(hoverIndex)}
                    cy={yOf(periods[hoverIndex].actual_mw ?? 0)}
                    r="4.5"
                    fill="#000"
                    stroke="#FFF"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={xOf(hoverIndex)}
                    cy={yOf(periods[hoverIndex].forecast_mw ?? 0)}
                    r="4.5"
                    fill="#FFF"
                    stroke="#000"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoverIndex !== null && periods[hoverIndex] && (
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: hoverIndex > n * 0.7 ? xOf(hoverIndex) - 220 : xOf(hoverIndex) + 15,
                  background: '#000',
                  color: '#fff',
                  padding: '8px 12px',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  lineHeight: 1.4,
                  pointerEvents: 'none',
                  zIndex: 20,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontWeight: 600, borderBottom: '1px solid #444', paddingBottom: 4, marginBottom: 4 }}>
                  SP {periods[hoverIndex].period_index} · {periods[hoverIndex].start_time.slice(11, 16)} GMT
                </div>
                <div>Actual: {fmtVal(periods[hoverIndex].actual_mw)}</div>
                <div>Forecast: {fmtVal(periods[hoverIndex].forecast_mw)}</div>
                <div style={{ color: (periods[hoverIndex].error_mw ?? 0) > 0 ? '#ff9999' : '#99ccff' }}>
                  Delta: {fmtSigned(periods[hoverIndex].error_mw)} ({periods[hoverIndex].percentage_error}%)
                </div>
                <div style={{ fontSize: 9, color: '#aaa', marginTop: 4 }}>
                  Run: {periods[hoverIndex].publish_time_used || 'Pre-Gate Closure'}
                </div>
              </div>
            )}
          </div>

          {/* Settlement Period Error Chart */}
          <div style={{ marginTop: 24 }}>
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
                Settlement Period Error (Forecast − Actual)
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                Dashed threshold: ±1,000 MW
              </span>
            </div>

            <svg viewBox={`0 0 ${W} ${EH}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }}>
              {/* Zero and Threshold Lines */}
              <line x1={PL} x2={W - PR} y1={eyOf(0)} y2={eyOf(0)} stroke="#000" strokeWidth="1" />
              <line x1={PL} x2={W - PR} y1={eyOf(1000)} y2={eyOf(1000)} stroke="#767676" strokeWidth="1" strokeDasharray="4 4" />
              <line x1={PL} x2={W - PR} y1={eyOf(-1000)} y2={eyOf(-1000)} stroke="#767676" strokeWidth="1" strokeDasharray="4 4" />

              <text x={PL - 8} y={eyOf(1000) + 4} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#666">
                +1,000
              </text>
              <text x={PL - 8} y={eyOf(-1000) + 4} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#666">
                −1,000
              </text>
              <text x={PL - 8} y={eyOf(0) + 4} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#000" fontWeight="600">
                0
              </text>

              {/* Error Bars */}
              {periods.map((p, i) => {
                const e = p.error_mw ?? 0;
                const y0 = eyOf(0);
                const y1 = eyOf(e);
                return (
                  <rect
                    key={i}
                    x={(xOf(i) - bw / 2).toFixed(1)}
                    y={Math.min(y0, y1).toFixed(1)}
                    width={bw.toFixed(1)}
                    height={Math.max(1, Math.abs(y1 - y0)).toFixed(1)}
                    fill={e > 0 ? '#000' : '#8F8F8F'}
                  />
                );
              })}

              {/* Time Labels */}
              {timeLabels.map((idx) => {
                const anchor = idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle';
                return (
                  <text
                    key={idx}
                    x={xOf(idx)}
                    y={EH - 6}
                    textAnchor={anchor}
                    fontSize={11}
                    fontFamily="var(--mono)"
                    fill="#444"
                  >
                    {getTimeStr(idx)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Column: Rule-Based Trading Insights Panel */}
        {showInsights && (
          <aside
            className="ins-panel"
            style={{
              border: '1px solid var(--fg)',
              padding: 16,
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              height: 'fit-content',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 13, textTransform: 'uppercase' }}>
                Operational Insights
              </h3>
              <button
                className="btn ghost"
                onClick={() => setShowInsights(false)}
                style={{ fontSize: 11, padding: '2px 6px' }}
              >
                Hide
              </button>
            </div>

            {/* Note 1: Evening Peak Over-Forecast */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  className="flag"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    padding: '1px 5px',
                    background: (metrics?.mbe || 0) > 500 ? '#000' : '#E4E4E4',
                    color: (metrics?.mbe || 0) > 500 ? '#fff' : '#000',
                  }}
                >
                  {(metrics?.mbe || 0) > 500 ? 'RISK' : 'WATCH'}
                </span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>Evening Ramp Exposure</span>
              </div>
              <p style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.4, color: 'var(--muted)' }}>
                {(metrics?.mbe || 0) > 500
                  ? `Evening ramp (SP 32–38) shows +${Math.round(metrics!.mbe / 100) * 100} MW over-forecast. Procure CCGT thermal reserve to prevent balancing cash-out penalty.`
                  : `Evening peak ramp is tracking within operational reserve tolerances.`}
              </p>
            </div>

            {/* Note 2: Major Imbalance Periods */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  className="flag"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    padding: '1px 5px',
                    background: '#000',
                    color: '#fff',
                  }}
                >
                  IMBALANCE
                </span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>Major Error Spikes</span>
              </div>
              <p style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.4, color: 'var(--muted)' }}>
                {periods.filter((p) => Math.abs(p.error_mw ?? 0) >= 1000).length} of {n} settlement periods exceeded ±1,000
                MW imbalance boundary.
              </p>
            </div>

            {/* Note 3: Max Deviation Record */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  className="flag"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    padding: '1px 5px',
                    background: '#E4E4E4',
                    color: '#000',
                  }}
                >
                  TAIL RISK
                </span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>Single Largest Miss</span>
              </div>
              <p style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.4, color: 'var(--muted)' }}>
                {metrics?.maxP
                  ? `Worst miss was ${fmtSigned(metrics.maxP.error_mw)} during SP ${metrics.maxP.period_index} (${metrics.maxP.start_time.slice(11, 16)} GMT).`
                  : 'No significant outlier detected.'}
              </p>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
};
