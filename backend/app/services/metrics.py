import numpy as np
import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
from app.db.repository import Repository
from app.services.alignment import AlignmentService
from app.schemas.metric import ErrorBin, PeakBreakdown, QuantitativeMetricsResponse

logger = logging.getLogger(__name__)

class MetricsCalculator:
    """Vectorized calculation of quantitative energy forecast accuracy metrics."""
    
    def __init__(self, repo: Repository, alignment_service: AlignmentService | None = None):
        self.repo = repo
        self.alignment = alignment_service or AlignmentService(repo)

    def calculate_metrics_for_range(
        self,
        start_date_str: str,
        end_date_str: str,
        gate_closure_hour: int = 11,
        resolution: str = "half_hour"
    ) -> QuantitativeMetricsResponse:
        """
        Calculates MAE, RMSE, MBE, WAPE, Peak/Off-peak splits, and distribution 
        across a sequence of delivery days.
        """
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        
        all_actuals: List[float] = []
        all_forecasts: List[float] = []
        all_errors: List[float] = []
        all_hours: List[int] = []
        
        current_dt = start_dt
        while current_dt <= end_dt:
            date_str = current_dt.strftime("%Y-%m-%d")
            aligned = self.alignment.get_day_ahead_aligned_data(
                delivery_date_str=date_str,
                gate_closure_hour=gate_closure_hour,
                resolution=resolution
            )
            
            for p in aligned.periods:
                if p.actual_mw is not None and p.forecast_mw is not None:
                    all_actuals.append(p.actual_mw)
                    all_forecasts.append(p.forecast_mw)
                    all_errors.append(p.error_mw)
                    
                    # Extract hour of day
                    dt = datetime.fromisoformat(p.start_time.replace("Z", "+00:00"))
                    all_hours.append(dt.hour)
                    
            current_dt += timedelta(days=1)
            
        if not all_actuals:
            # Empty fallback
            return self._empty_metrics(start_date_str, end_date_str, gate_closure_hour)

        # Vectorized calculations via NumPy
        act_arr = np.array(all_actuals, dtype=np.float64)
        fc_arr = np.array(all_forecasts, dtype=np.float64)
        err_arr = np.array(all_errors, dtype=np.float64)
        hours_arr = np.array(all_hours, dtype=np.int32)
        
        n = len(err_arr)
        mae = float(np.mean(np.abs(err_arr)))
        rmse = float(np.sqrt(np.mean(err_arr ** 2)))
        mbe = float(np.mean(err_arr))
        
        # WAPE = sum(|error|) / sum(actual) * 100
        sum_actual = float(np.sum(act_arr))
        wape = float((np.sum(np.abs(err_arr)) / sum_actual) * 100.0) if sum_actual > 0 else 0.0
        
        max_over = float(np.max(err_arr))
        max_under = float(np.min(err_arr))
        
        # Peak (07:00 to 19:00 GMT) vs Off-Peak
        peak_mask = (hours_arr >= 7) & (hours_arr < 19)
        offpeak_mask = ~peak_mask
        
        peak_mae = float(np.mean(np.abs(err_arr[peak_mask]))) if np.any(peak_mask) else 0.0
        peak_bias = float(np.mean(err_arr[peak_mask])) if np.any(peak_mask) else 0.0
        
        offpeak_mae = float(np.mean(np.abs(err_arr[offpeak_mask]))) if np.any(offpeak_mask) else 0.0
        offpeak_bias = float(np.mean(err_arr[offpeak_mask])) if np.any(offpeak_mask) else 0.0
        
        peak_breakdown = PeakBreakdown(
            peak_mae_mw=round(peak_mae, 2),
            peak_bias_mw=round(peak_bias, 2),
            offpeak_mae_mw=round(offpeak_mae, 2),
            offpeak_bias_mw=round(offpeak_bias, 2)
        )
        
        distribution = self._compute_error_bins(err_arr, n)
        
        return QuantitativeMetricsResponse(
            start_date=start_date_str,
            end_date=end_date_str,
            gate_closure_hour=gate_closure_hour,
            total_evaluated_periods=n,
            mae_mw=round(mae, 2),
            rmse_mw=round(rmse, 2),
            mean_bias_error_mw=round(mbe, 2),
            wape_percent=round(wape, 2),
            max_over_forecast_mw=round(max_over, 2),
            max_under_forecast_mw=round(max_under, 2),
            peak_offpeak=peak_breakdown,
            error_distribution=distribution
        )

    def _compute_error_bins(self, err_arr: np.ndarray, total_n: int) -> List[ErrorBin]:
        """Categorizes errors into 6 structured histogram ranges for traders."""
        bins_def = [
            ("Large Under-forecast (< -2000 MW)", -np.inf, -2000.0),
            ("Moderate Under-forecast (-2000 to -500 MW)", -2000.0, -500.0),
            ("Near Accurate (-500 to +500 MW)", -500.0, 500.0),
            ("Moderate Over-forecast (+500 to +2000 MW)", 500.0, 2000.0),
            ("Large Over-forecast (> +2000 MW)", 2000.0, np.inf),
        ]
        
        result: List[ErrorBin] = []
        for label, low, high in bins_def:
            if low == -np.inf:
                count = int(np.sum(err_arr < high))
            elif high == np.inf:
                count = int(np.sum(err_arr >= low))
            else:
                count = int(np.sum((err_arr >= low) & (err_arr < high)))
                
            pct = round((count / total_n) * 100.0, 2) if total_n > 0 else 0.0
            result.append(ErrorBin(
                bin_label=label,
                bin_min=float(low) if low != -np.inf else -99999.0,
                bin_max=float(high) if high != np.inf else 99999.0,
                count=count,
                percentage=pct
            ))
            
        return result

    def _empty_metrics(self, start_date: str, end_date: str, gate_hour: int) -> QuantitativeMetricsResponse:
        return QuantitativeMetricsResponse(
            start_date=start_date,
            end_date=end_date,
            gate_closure_hour=gate_hour,
            total_evaluated_periods=0,
            mae_mw=0.0,
            rmse_mw=0.0,
            mean_bias_error_mw=0.0,
            wape_percent=0.0,
            max_over_forecast_mw=0.0,
            max_under_forecast_mw=0.0,
            peak_offpeak=PeakBreakdown(peak_mae_mw=0.0, peak_bias_mw=0.0, offpeak_mae_mw=0.0, offpeak_bias_mw=0.0),
            error_distribution=[]
        )
