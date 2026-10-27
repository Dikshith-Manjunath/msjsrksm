from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class ErrorBin(BaseModel):
    bin_label: str = Field(..., description="Range label, e.g., '0 to 500 MW'")
    bin_min: float
    bin_max: float
    count: int
    percentage: float

class PeakBreakdown(BaseModel):
    peak_mae_mw: float = Field(..., description="MAE during 07:00-19:00 GMT")
    peak_bias_mw: float = Field(..., description="Bias during 07:00-19:00 GMT")
    offpeak_mae_mw: float = Field(..., description="MAE during 19:00-07:00 GMT")
    offpeak_bias_mw: float = Field(..., description="Bias during 19:00-07:00 GMT")

class QuantitativeMetricsResponse(BaseModel):
    start_date: str
    end_date: str
    gate_closure_hour: int
    total_evaluated_periods: int
    mae_mw: float = Field(..., description="Mean Absolute Error in MW")
    rmse_mw: float = Field(..., description="Root Mean Squared Error in MW")
    mean_bias_error_mw: float = Field(..., description="Mean Bias: Positive = Over-forecast, Negative = Under-forecast")
    wape_percent: float = Field(..., description="Weighted Absolute Percentage Error (%)")
    max_over_forecast_mw: float = Field(..., description="Worst-case over-prediction in MW")
    max_under_forecast_mw: float = Field(..., description="Worst-case under-prediction in MW")
    peak_offpeak: PeakBreakdown
    error_distribution: List[ErrorBin]
