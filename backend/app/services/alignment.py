import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from app.db.repository import Repository
from app.schemas.forecast import AlignedPeriod, ForecastSummary, DayAheadForecastResponse

logger = logging.getLogger(__name__)

class AlignmentService:
    """Aligns UK wind actuals and forecasts for Day-Ahead trading with strict gate-closure lookahead protection."""
    
    def __init__(self, repo: Repository):
        self.repo = repo

    def get_day_ahead_aligned_data(
        self,
        delivery_date_str: str,
        gate_closure_hour: int = 11,
        resolution: str = "half_hour",
        interpolation: str = "linear"
    ) -> DayAheadForecastResponse:
        """
        Calculates the aligned wind power actuals vs latest day-ahead forecasts.
        - delivery_date_str: 'YYYY-MM-DD'
        - gate_closure_hour: Hour on D-1 when gate closes (default 11:00 GMT)
        - resolution: 'half_hour' (48 settlement periods) or 'hour' (24 hourly buckets)
        """
        # Parse delivery date & calculate decision cutoff
        delivery_dt = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
        decision_dt = delivery_dt - timedelta(days=1)
        cutoff_str = f"{decision_dt.strftime('%Y-%m-%d')}T{gate_closure_hour:02d}:00:00Z"
        
        # 1. Fetch raw data from database
        actuals = self.repo.get_actuals_for_date(delivery_date_str)
        forecasts = self.repo.get_forecasts_for_delivery_date(delivery_date_str, cutoff_str)
        
        # Build quick lookup dictionary for forecasts: start_time -> forecast dict
        fc_map = {f["start_time"]: f for f in forecasts}
        
        aligned_periods: List[AlignedPeriod] = []
        
        if resolution == "hour":
            aligned_periods = self._align_hourly(delivery_date_str, actuals, fc_map)
        else:
            aligned_periods = self._align_half_hourly(
                delivery_date_str, actuals, fc_map, interpolation
            )
            
        summary = self._compute_summary(aligned_periods)
        
        return DayAheadForecastResponse(
            delivery_date=delivery_date_str,
            decision_date=decision_dt.strftime("%Y-%m-%d"),
            gate_closure_cutoff=cutoff_str,
            resolution=resolution,
            total_periods=len(aligned_periods),
            summary=summary,
            periods=aligned_periods
        )

    def _align_half_hourly(
        self,
        delivery_date: str,
        actuals: List[Dict[str, Any]],
        fc_map: Dict[str, Dict[str, Any]],
        interpolation: str
    ) -> List[AlignedPeriod]:
        """Aligns data across the 48 standard UK settlement periods."""
        # Index actuals by settlement period (1 to 48)
        act_by_sp = {a["settlement_period"]: a for a in actuals}
        
        periods: List[AlignedPeriod] = []
        
        for sp in range(1, 49):
            # Calculate start_time for SP (SP 1 = 00:00, SP 2 = 00:30, SP 3 = 01:00, etc.)
            total_minutes = (sp - 1) * 30
            hour = total_minutes // 60
            minute = total_minutes % 60
            sp_start_iso = f"{delivery_date}T{hour:02d}:{minute:02d}:00Z"
            hour_iso = f"{delivery_date}T{hour:02d}:00:00Z"
            
            # Actual value
            actual_row = act_by_sp.get(sp)
            actual_mw = round(actual_row["generation"], 2) if actual_row else None
            
            # Forecast resolution matching
            forecast_mw = None
            publish_time_used = None
            
            # Check if exact forecast exists for this 30-min start_time
            fc_exact = fc_map.get(sp_start_iso)
            if fc_exact:
                forecast_mw = round(fc_exact["generation"], 2)
                publish_time_used = fc_exact["publish_time"]
            elif minute == 0:
                # Top of the hour: match with hourly WINDFOR
                fc_row = fc_map.get(hour_iso)
                if fc_row:
                    forecast_mw = round(fc_row["generation"], 2)
                    publish_time_used = fc_row["publish_time"]
            else:
                # Half past the hour (:30): interpolate or step
                fc_current = fc_map.get(hour_iso)
                next_hour_iso = f"{delivery_date}T{(hour + 1):02d}:00:00Z" if hour < 23 else None
                fc_next = fc_map.get(next_hour_iso) if next_hour_iso else None
                
                if fc_current:
                    publish_time_used = fc_current["publish_time"]
                    if interpolation == "linear" and fc_next:
                        # Linear interpolation between hour H and hour H+1
                        forecast_mw = round((fc_current["generation"] + fc_next["generation"]) / 2.0, 2)
                    else:
                        # Step / forward fill
                        forecast_mw = round(fc_current["generation"], 2)
            
            # Error metrics for this period
            error_mw = None
            abs_error_mw = None
            pct_error = None
            
            if actual_mw is not None and forecast_mw is not None:
                error_mw = round(forecast_mw - actual_mw, 2)
                abs_error_mw = round(abs(error_mw), 2)
                if actual_mw > 0:
                    pct_error = round((error_mw / actual_mw) * 100.0, 2)
                    
            periods.append(AlignedPeriod(
                period_index=sp,
                start_time=sp_start_iso,
                actual_mw=actual_mw,
                forecast_mw=forecast_mw,
                error_mw=error_mw,
                absolute_error_mw=abs_error_mw,
                percentage_error=pct_error,
                publish_time_used=publish_time_used
            ))
            
        return periods

    def _align_hourly(
        self,
        delivery_date: str,
        actuals: List[Dict[str, Any]],
        fc_map: Dict[str, Dict[str, Any]]
    ) -> List[AlignedPeriod]:
        """Aligns data across 24 hourly intervals by averaging the two half-hourly actuals per hour."""
        act_by_sp = {a["settlement_period"]: a["generation"] for a in actuals}
        periods: List[AlignedPeriod] = []
        
        for hour in range(24):
            hour_iso = f"{delivery_date}T{hour:02d}:00:00Z"
            sp1 = hour * 2 + 1
            sp2 = hour * 2 + 2
            
            # Average the two half-hourly actual generation values
            act_values = [act_by_sp[sp] for sp in (sp1, sp2) if sp in act_by_sp]
            actual_mw = round(sum(act_values) / len(act_values), 2) if act_values else None
            
            fc_row = fc_map.get(hour_iso)
            forecast_mw = round(fc_row["generation"], 2) if fc_row else None
            publish_time_used = fc_row["publish_time"] if fc_row else None
            
            error_mw = None
            abs_error_mw = None
            pct_error = None
            
            if actual_mw is not None and forecast_mw is not None:
                error_mw = round(forecast_mw - actual_mw, 2)
                abs_error_mw = round(abs(error_mw), 2)
                if actual_mw > 0:
                    pct_error = round((error_mw / actual_mw) * 100.0, 2)
                    
            periods.append(AlignedPeriod(
                period_index=hour + 1,
                start_time=hour_iso,
                actual_mw=actual_mw,
                forecast_mw=forecast_mw,
                error_mw=error_mw,
                absolute_error_mw=abs_error_mw,
                percentage_error=pct_error,
                publish_time_used=publish_time_used
            ))
            
        return periods

    def _compute_summary(self, periods: List[AlignedPeriod]) -> ForecastSummary:
        """Computes summary extremes and averages for the delivery day."""
        actuals = [p.actual_mw for p in periods if p.actual_mw is not None]
        forecasts = [p.forecast_mw for p in periods if p.forecast_mw is not None]
        
        mean_actual = round(sum(actuals) / len(actuals), 2) if actuals else 0.0
        mean_forecast = round(sum(forecasts) / len(forecasts), 2) if forecasts else 0.0
        max_actual = max(actuals) if actuals else 0.0
        max_forecast = max(forecasts) if forecasts else 0.0
        
        peak_actual_time = next((p.start_time for p in periods if p.actual_mw == max_actual), None)
        peak_forecast_time = next((p.start_time for p in periods if p.forecast_mw == max_forecast), None)
        
        return ForecastSummary(
            mean_actual_mw=mean_actual,
            mean_forecast_mw=mean_forecast,
            max_actual_mw=max_actual,
            max_forecast_mw=max_forecast,
            peak_actual_time=peak_actual_time,
            peak_forecast_time=peak_forecast_time
        )
