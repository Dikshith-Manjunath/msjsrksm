import {
  DayAheadForecastResponse,
  QuantitativeMetricsResponse,
  HealthStatus,
  ForecastRevisionsResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : '';

export async function fetchHealth(): Promise<{ data: HealthStatus; pingMs: number }> {
  const t0 = performance.now();
  const res = await fetch(`${API_BASE}/health`);
  const pingMs = Math.round(performance.now() - t0);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  const data = await res.json();
  return { data, pingMs };
}

export async function fetchDates(): Promise<{ dates: string[]; default_delivery_date: string; default_gate_closure_hour: number }> {
  const res = await fetch(`${API_BASE}/api/v1/dates`);
  if (!res.ok) throw new Error(`Failed to fetch dates (${res.status})`);
  return res.json();
}

export async function fetchForecasts(
  deliveryDate: string,
  gateClosureHour: number = 11,
  resolution: 'half_hour' | 'hour' = 'half_hour',
  interpolation: 'linear' | 'step' = 'linear'
): Promise<DayAheadForecastResponse> {
  const params = new URLSearchParams({
    delivery_date: deliveryDate,
    gate_closure_hour: gateClosureHour.toString(),
    resolution,
    interpolation,
  });
  const res = await fetch(`${API_BASE}/api/v1/forecasts?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load forecast data (${res.status})`);
  return res.json();
}

export async function fetchMetrics(
  startDate: string,
  endDate: string,
  gateClosureHour: number = 11,
  resolution: 'half_hour' | 'hour' = 'half_hour',
  hoursFilter: 'all' | 'peak' | 'offpeak' = 'all'
): Promise<QuantitativeMetricsResponse> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    gate_closure_hour: gateClosureHour.toString(),
    resolution,
    hours_filter: hoursFilter,
  });
  const res = await fetch(`${API_BASE}/api/v1/metrics?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load metrics data (${res.status})`);
  return res.json();
}

export async function triggerSync(force: boolean = false): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/sync?force=${force}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Sync trigger failed (${res.status})`);
  return res.json();
}

export async function fetchForecastRevisions(
  startTime: string,
  cutoff?: string
): Promise<ForecastRevisionsResponse> {
  const params = new URLSearchParams({ start_time: startTime });
  if (cutoff) params.append('cutoff', cutoff);
  const res = await fetch(`${API_BASE}/api/v1/forecasts/revisions?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch forecast revisions (${res.status})`);
  return res.json();
}
