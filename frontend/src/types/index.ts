export interface AlignedPeriod {
  period_index: number;
  start_time: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  error_mw: number | null;
  absolute_error_mw: number | null;
  percentage_error: number | null;
  publish_time_used: string | null;
}

export interface ForecastSummary {
  mean_actual_mw: number;
  mean_forecast_mw: number;
  max_actual_mw: number;
  max_forecast_mw: number;
  peak_actual_time: string | null;
  peak_forecast_time: string | null;
}

export interface DayAheadForecastResponse {
  delivery_date: string;
  decision_date: string;
  gate_closure_cutoff: string;
  resolution: 'half_hour' | 'hour';
  total_periods: number;
  summary: ForecastSummary;
  periods: AlignedPeriod[];
}

export interface ErrorBin {
  bin_label: string;
  bin_min: number;
  bin_max: number;
  count: number;
  percentage: number;
}

export interface HourlyBoxPlot {
  hour: number;
  label: string;
  sample_count: number;
  median_mw: number;
  q1_mw: number;
  q3_mw: number;
  iqr_mw: number;
  whisker_low_mw: number;
  whisker_high_mw: number;
  outliers_mw: number[];
}

export interface PeakBreakdown {
  peak_mae_mw: number;
  peak_bias_mw: number;
  offpeak_mae_mw: number;
  offpeak_bias_mw: number;
}

export interface DistributionStats {
  mean_mw: number;
  std_dev_mw: number;
  excess_kurtosis: number;
  pct_beyond_2sigma: number;
}

export interface BiasRatio {
  pct_over_forecast: number;
  pct_under_forecast: number;
  pct_exact: number;
}

export interface QuantitativeMetricsResponse {
  start_date: string;
  end_date: string;
  gate_closure_hour: number;
  hours_filter: 'all' | 'peak' | 'offpeak';
  total_evaluated_periods: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_error_mw: number;
  wape_percent: number;
  correlation_r2: number;
  net_imbalance_gwh: number;
  bias_ratio: BiasRatio;
  max_over_forecast_mw: number;
  max_under_forecast_mw: number;
  peak_offpeak: PeakBreakdown;
  distribution_stats: DistributionStats;
  error_distribution: ErrorBin[];
  hourly_box_plots: HourlyBoxPlot[];
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  database: {
    path: string;
    actual_records: number;
    forecast_records: number;
    min_date: string | null;
    max_date: string | null;
    is_seeded: boolean;
  };
}

export interface ForecastRevisionItem {
  publish_time: string;
  forecast_mw: number;
  error_mw: number | null;
  percentage_error: number | null;
  is_prior_to_cutoff: boolean;
}

export interface ForecastRevisionsResponse {
  target_start_time: string;
  actual_mw: number | null;
  gate_closure_cutoff: string | null;
  total_revisions: number;
  revisions: ForecastRevisionItem[];
}
