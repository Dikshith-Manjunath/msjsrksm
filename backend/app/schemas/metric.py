from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class ErrorBin(BaseModel):
    bin_label: str = Field(..., description="Range label, e.g., '0 to 250 MW'")
    bin_min: float
    bin_max: float
    count: int
    percentage: float

class HourlyBoxPlot(BaseModel):
    hour: int = Field(..., description="Hour of day (0 to 23 GMT)")
    label: str = Field(..., description="Hour label, e.g., '03:00'")
    sample_count: int
    median_mw: float
    q1_mw: float
    q3_mw: float
    iqr_mw: float
    whisker_low_mw: float
    whisker_high_mw: float
    outliers_mw: List[float]

class PeakBreakdown(BaseModel):
    peak_mae_mw: float = Field(..., description="MAE during 07:00-19:00 GMT")
    peak_bias_mw: float = Field(..., description="Bias during 07:00-19:00 GMT")
    offpeak_mae_mw: float = Field(..., description="MAE during 19:00-07:00 GMT")
    offpeak_bias_mw: float = Field(..., description="Bias during 19:00-07:00 GMT")

class DistributionStats(BaseModel):
    mean_mw: float
    std_dev_mw: float
    excess_kurtosis: float
    pct_beyond_2sigma: float

class BiasRatio(BaseModel):
    pct_over_forecast: float = Field(..., description="Percentage of periods where forecast > actual")
    pct_under_forecast: float = Field(..., description="Percentage of periods where forecast < actual")
    pct_exact: float

class QuantitativeMetricsResponse(BaseModel):
    start_date: str
    end_date: str
    gate_closure_hour: int
    hours_filter: str = Field("all", description="'all', 'peak' (07-19 GMT), or 'offpeak' (19-07 GMT)")
    total_evaluated_periods: int
    mae_mw: float = Field(..., description="Mean Absolute Error in MW")
    rmse_mw: float = Field(..., description="Root Mean Squared Error in MW")
    mean_bias_error_mw: float = Field(..., description="Mean Bias in MW (Positive = Over-forecast)")
    wape_percent: float = Field(..., description="Weighted Absolute Percentage Error (%)")
    correlation_r2: float = Field(..., description="Coefficient of determination R² (0.0 to 1.0)")
    net_imbalance_gwh: float = Field(..., description="Net volumetric imbalance in GWh (sum(error) * 0.5h / 1000)")
    bias_ratio: BiasRatio
    max_over_forecast_mw: float
    max_under_forecast_mw: float
    peak_offpeak: PeakBreakdown
    distribution_stats: DistributionStats
    error_distribution: List[ErrorBin]
    hourly_box_plots: List[HourlyBoxPlot]
