import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatusStrip } from './components/StatusStrip';
import { DecisionDesk } from './components/DecisionDesk';
import { RiskEvaluation } from './components/RiskEvaluation';
import { LandingPage } from './components/LandingPage';
import { Footer } from './components/Footer';
import { TourModal } from './components/TourModal';
import { SensitivityModal } from './components/SensitivityModal';
import { fetchHealth, fetchDates, fetchForecasts, fetchMetrics, triggerSync } from './api/client';
import { DayAheadForecastResponse, QuantitativeMetricsResponse, HealthStatus } from './types';

export const App: React.FC = () => {
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('wind_desk_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wind_desk_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation & View Routing ('landing' | 'desk' | 'risk')
  const [currentTab, setCurrentTab] = useState<'landing' | 'desk' | 'risk'>('desk');

  // Shared Settings
  const [deliveryDate, setDeliveryDate] = useState<string>('2026-01-15');
  const [allDates, setAllDates] = useState<string[]>([]);
  const [gateClosureHour, setGateClosureHour] = useState<number>(11);
  const [resolution, setResolution] = useState<'half_hour' | 'hour'>('half_hour');
  const [units, setUnits] = useState<'MW' | 'GW'>('MW');

  // Risk & Evaluation View Settings
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-01-31');
  const [hoursFilter, setHoursFilter] = useState<'all' | 'peak' | 'offpeak'>('all');
  const [riskGateHour, setRiskGateHour] = useState<number>(11);

  // Data States
  const [forecastData, setForecastData] = useState<DayAheadForecastResponse | null>(null);
  const [metricsData, setMetricsData] = useState<QuantitativeMetricsResponse | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [loadingDesk, setLoadingDesk] = useState<boolean>(false);
  const [loadingRisk, setLoadingRisk] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modal States
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [isSensitivityOpen, setIsSensitivityOpen] = useState<boolean>(false);

  // Initialize hash & pathname route listener
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;

      if (hash === '#risk') {
        setCurrentTab('risk');
      } else if (hash === '#landing' || hash === '#features' || hash === '#views' || hash === '#method' || hash === '#start') {
        setCurrentTab('landing');
      } else {
        setCurrentTab('desk');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTab = (tab: 'landing' | 'desk' | 'risk') => {
    setCurrentTab(tab);
    window.location.hash =
      tab === 'desk'
        ? '#desk'
        : tab === 'risk'
        ? '#risk'
        : '#landing';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Periodic health & ping check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data, pingMs } = await fetchHealth();
        setHealth(data);
        setPingMs(pingMs);
      } catch (err) {
        console.error('Health check failed', err);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch available dates on load
  useEffect(() => {
    const loadDates = async () => {
      try {
        const res = await fetchDates();
        if (res.dates.length > 0) {
          setAllDates(res.dates);
          if (res.dates.includes('2026-01-15')) {
            setDeliveryDate('2026-01-15');
          } else {
            setDeliveryDate(res.dates[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load dates', err);
        const fallback = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
        setAllDates(fallback);
      }
    };
    loadDates();
  }, []);

  // Fetch Forecasts for Decision Desk
  const loadForecasts = useCallback(async () => {
    setLoadingDesk(true);
    try {
      const res = await fetchForecasts(deliveryDate, gateClosureHour, resolution, 'linear');
      setForecastData(res);
    } catch (err) {
      console.error('Failed to load forecast data', err);
    } finally {
      setLoadingDesk(false);
    }
  }, [deliveryDate, gateClosureHour, resolution]);

  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);

  // Fetch Metrics for Risk & Evaluation
  const loadRiskMetrics = useCallback(async () => {
    setLoadingRisk(true);
    try {
      const res = await fetchMetrics(startDate, endDate, riskGateHour, resolution, hoursFilter);
      setMetricsData(res);
    } catch (err) {
      console.error('Failed to load risk metrics', err);
    } finally {
      setLoadingRisk(false);
    }
  }, [startDate, endDate, riskGateHour, resolution, hoursFilter]);

  useEffect(() => {
    loadRiskMetrics();
  }, [loadRiskMetrics]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentTab === 'desk') {
        const idx = allDates.indexOf(deliveryDate);
        if (idx > 0) setDeliveryDate(allDates[idx - 1]);
      } else if (e.key === 'ArrowRight' && currentTab === 'desk') {
        const idx = allDates.indexOf(deliveryDate);
        if (idx >= 0 && idx < allDates.length - 1) setDeliveryDate(allDates[idx + 1]);
      } else if (e.key === 't' || e.key === 'T') {
        handleSelectTab('desk');
      } else if (e.key === 'Escape') {
        setIsTourOpen(false);
        setIsSensitivityOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allDates, deliveryDate, currentTab]);

  // Trigger Live Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await triggerSync(true);
      setTimeout(() => {
        setIsSyncing(false);
        loadForecasts();
        loadRiskMetrics();
      }, 3000);
    } catch (err) {
      console.error('Sync failed', err);
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Top Navigation — outside .app so it's always full viewport width */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        health={health}
        pingMs={pingMs}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenSensitivity={() => setIsSensitivityOpen(true)}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="app">
        {/* Real-Time Market Status Strip (Shown on Desk and Risk views) */}
        {currentTab !== 'landing' && (
          <StatusStrip deliveryDate={deliveryDate} gateClosureHour={gateClosureHour} />
        )}

        {/* Main Tab Views */}
        <main>
          {currentTab === 'landing' ? (
            <LandingPage onNavigate={handleSelectTab} theme={theme} />
          ) : currentTab === 'desk' ? (
            <DecisionDesk
              data={forecastData}
              loading={loadingDesk}
              deliveryDate={deliveryDate}
              onChangeDate={setDeliveryDate}
              gateClosureHour={gateClosureHour}
              onChangeGateClosure={setGateClosureHour}
              resolution={resolution}
              onChangeResolution={setResolution}
              units={units}
              onChangeUnits={setUnits}
              allDates={allDates}
            />
          ) : (
            <RiskEvaluation
              metrics={metricsData}
              loading={loadingRisk}
              startDate={startDate}
              endDate={endDate}
              onChangeDateRange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
              }}
              gateClosureHour={riskGateHour}
              onChangeGateClosure={setRiskGateHour}
              hoursFilter={hoursFilter}
              onChangeHoursFilter={setHoursFilter}
              units={units}
              onChangeUnits={setUnits}
            />
          )}
        </main>

        {/* Universal Site Footer on ALL Pages */}
        <Footer pingMs={pingMs} onNavigate={handleSelectTab} />

        {/* Tour / Onboarding Modal */}
        <TourModal isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />

        {/* Gate Sensitivity Comparison Modal */}
        <SensitivityModal
          isOpen={isSensitivityOpen}
          onClose={() => setIsSensitivityOpen(false)}
          deliveryDate={deliveryDate}
        />
      </div>
    </>
  );
};
