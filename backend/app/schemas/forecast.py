from pydantic import BaseModel, Field
from typing import List, Optional

class AlignedPeriod(BaseModel):
    period_index: int = Field(..., description="Settlement Period (1-48) or Hour Index (1-24)")
    start_time: str = Field(..., description="Target half-hour or hourly start time in ISO-8601")
    actual_mw: Optional[float] = Field(None, description="Actual wind generation in MW")
    forecast_mw: Optional[float] = Field(None, description="Forecasted wind generation in MW")
    error_mw: Optional[float] = Field(None, description="Forecast - Actual error in MW (Positive = Over-forecast)")
    absolute_error_mw: Optional[float] = Field(None, description="Absolute error in MW")
    percentage_error: Optional[float] = Field(None, description="Signed percentage error relative to actual")
    publish_time_used: Optional[str] = Field(None, description="Timestamp of the forecast model run used")

class ForecastSummary(BaseModel):
    mean_actual_mw: float
    mean_forecast_mw: float
    max_actual_mw: float
    max_forecast_mw: float
    peak_actual_time: Optional[str]
    peak_forecast_time: Optional[str]

class DayAheadForecastResponse(BaseModel):
    delivery_date: str
    decision_date: str
    gate_closure_cutoff: str
    resolution: str
    total_periods: int
    summary: ForecastSummary
    periods: List[AlignedPeriod]
