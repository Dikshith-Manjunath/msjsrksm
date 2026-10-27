import numpy as np
import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
from app.db.repository import Repository
from app.services.alignment import AlignmentService
from app.schemas.metric import (
    ErrorBin, 
    PeakBreakdown, 
    HourlyBoxPlot, 
    DistributionStats, 
    BiasRatio, 
    QuantitativeMetricsResponse
)

logger = logging.getLogger(__name__)

class MetricsCalculator:
    """Vectorized calculation of quantitative energy forecast accuracy metrics for Decision Desk & Risk views."""
    
    def __init__(self, repo: Repository, alignment_service: AlignmentService | None = None):
        self.repo = repo
        self.alignment = alignment_service or AlignmentService(repo)

    def calculate_metrics_for_range(
        self,
        start_date_str: str,
        end_date_str: str,
        gate_closure_hour: int = 11,
        resolution: str = "half_hour",
        hours_filter: str = "all"
    ) -> QuantitativeMetricsResponse:
        """
        Calculates MAE, RMSE, MBE, WAPE, R², Net Imbalance (GWh), Bias Ratios,
        Gaussian moments, 250MW error distribution histogram, and 24-hr box plot stats.
        - hours_filter: 'all', 'peak' (07-19 GMT), or 'offpeak' (19-07 GMT)
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
                    # Extract hour of day
                    dt = datetime.fromisoformat(p.start_time.replace("Z", "+00:00"))
                    h = dt.hour
                    
                    all_actuals.append(p.actual_mw)
                    all_forecasts.append(p.forecast_mw)
                    all_errors.append(p.error_mw)
                    all_hours.append(h)
                    
            current_dt += timedelta(days=1)
            
        if not all_actuals:
            return self._empty_metrics(start_date_str, end_date_str, gate_closure_hour, hours_filter)

        # Full arrays before hours filtering (for box plot calculation)
        raw_act = np.array(all_actuals, dtype=np.float64)
        raw_fc = np.array(all_forecasts, dtype=np.float64)
        raw_err = np.array(all_errors, dtype=np.float64)
        raw_hours = np.array(all_hours, dtype=np.int32)
        
        # Hourly Box Plots are always computed across all 24 hours (unfiltered by hours_filter per spec)
        hourly_box_plots = self._compute_hourly_box_plots(raw_err, raw_hours)

        # Apply hours filter to scorecard & histogram if requested
        if hours_filter == "peak":
            mask = (raw_hours >= 7) & (raw_hours < 19)
        elif hours_filter == "offpeak":
            mask = (raw_hours < 7) | (raw_hours >= 19)
        else:
            mask = np.ones(len(raw_hours), dtype=bool)

        act_arr = raw_act[mask]
        fc_arr = raw_fc[mask]
        err_arr = raw_err[mask]
        hours_arr = raw_hours[mask]
        
        n = len(err_arr)
        if n == 0:
            return self._empty_metrics(start_date_str, end_date_str, gate_closure_hour, hours_filter)

        mae = float(np.mean(np.abs(err_arr)))
        rmse = float(np.sqrt(np.mean(err_arr ** 2)))
        mbe = float(np.mean(err_arr))
        
        # WAPE = sum(|error|) / sum(actual) * 100
        sum_actual = float(np.sum(act_arr))
        wape = float((np.sum(np.abs(err_arr)) / sum_actual) * 100.0) if sum_actual > 0 else 0.0
        
        # Correlation R² (Coefficient of determination)
        if n > 1 and np.std(act_arr) > 0 and np.std(fc_arr) > 0:
            corr = np.corrcoef(act_arr, fc_arr)[0, 1]
            r2 = float(corr ** 2) if not np.isnan(corr) else 0.0
        else:
            r2 = 0.0

        # Net Volumetric Imbalance in GWh: sum(errors) * 0.5 hours / 1000
        net_imbalance_gwh = float(np.sum(err_arr) * 0.5 / 1000.0)
        
        # Bias Ratio
        pct_over = float(np.mean(err_arr > 0) * 100.0)
        pct_under = float(np.mean(err_arr < 0) * 100.0)
        pct_exact = float(np.mean(err_arr == 0) * 100.0)
        bias_ratio = BiasRatio(
            pct_over_forecast=round(pct_over, 1),
            pct_under_forecast=round(pct_under, 1),
            pct_exact=round(pct_exact, 1)
        )

        max_over = float(np.max(err_arr))
        max_under = float(np.min(err_arr))
        
        # Peak vs Off-Peak
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

        # Gaussian moments & kurtosis
        mean_err = float(np.mean(err_arr))
        std_err = float(np.std(err_arr))
        if std_err > 0:
            excess_kurt = float(np.mean(((err_arr - mean_err) / std_err) ** 4) - 3.0)
            share_beyond_2sigma = float(np.mean(np.abs(err_arr - mean_err) > 2.0 * std_err) * 100.0)
        else:
            excess_kurt = 0.0
            share_beyond_2sigma = 0.0

        dist_stats = DistributionStats(
            mean_mw=round(mean_err, 2),
            std_dev_mw=round(std_err, 2),
            excess_kurtosis=round(excess_kurt, 2),
            pct_beyond_2sigma=round(share_beyond_2sigma, 1)
        )

        distribution = self._compute_250mw_bins(err_arr, n)

        return QuantitativeMetricsResponse(
            start_date=start_date_str,
            end_date=end_date_str,
            gate_closure_hour=gate_closure_hour,
            hours_filter=hours_filter,
            total_evaluated_periods=n,
            mae_mw=round(mae, 2),
            rmse_mw=round(rmse, 2),
            mean_bias_error_mw=round(mbe, 2),
            wape_percent=round(wape, 2),
            correlation_r2=round(r2, 3),
            net_imbalance_gwh=round(net_imbalance_gwh, 2),
            bias_ratio=bias_ratio,
            max_over_forecast_mw=round(max_over, 2),
            max_under_forecast_mw=round(max_under, 2),
            peak_offpeak=peak_breakdown,
            distribution_stats=dist_stats,
            error_distribution=distribution,
            hourly_box_plots=hourly_box_plots
        )

    def _compute_250mw_bins(self, err_arr: np.ndarray, total_n: int) -> List[ErrorBin]:
        """Categorizes errors into 250 MW buckets matching the UI specification (-4000 to +4000 MW)."""
        bins: List[ErrorBin] = []
        # Lower tail
        count_low = int(np.sum(err_arr < -4000))
        bins.append(ErrorBin(
            bin_label="< -4000 MW",
            bin_min=-99999.0,
            bin_max=-4000.0,
            count=count_low,
            percentage=round(count_low / total_n * 100.0, 2)
        ))
        
        # 250 MW intervals from -4000 to +4000
        for edge in range(-4000, 4000, 250):
            low = float(edge)
            high = float(edge + 250)
            count = int(np.sum((err_arr >= low) & (err_arr < high)))
            bins.append(ErrorBin(
                bin_label=f"{int(low)} to {int(high)} MW",
                bin_min=low,
                bin_max=high,
                count=count,
                percentage=round(count / total_n * 100.0, 2)
            ))
            
        # Upper tail
        count_high = int(np.sum(err_arr >= 4000))
        bins.append(ErrorBin(
            bin_label="> +4000 MW",
            bin_min=4000.0,
            bin_max=99999.0,
            count=count_high,
            percentage=round(count_high / total_n * 100.0, 2)
        ))
        return bins

    def _compute_hourly_box_plots(self, raw_err: np.ndarray, raw_hours: np.ndarray) -> List[HourlyBoxPlot]:
        """Calculates IQR, median, whiskers, and outlier points for each of the 24 hours of the day."""
        box_plots: List[HourlyBoxPlot] = []
        for h in range(24):
            h_mask = (raw_hours == h)
            h_errs = raw_err[h_mask]
            label = f"{h:02d}:00"
            
            if len(h_errs) == 0:
                box_plots.append(HourlyBoxPlot(
                    hour=h, label=label, sample_count=0,
                    median_mw=0.0, q1_mw=0.0, q3_mw=0.0, iqr_mw=0.0,
                    whisker_low_mw=0.0, whisker_high_mw=0.0, outliers_mw=[]
                ))
                continue
                
            q1 = float(np.percentile(h_errs, 25))
            median = float(np.median(h_errs))
            q3 = float(np.percentile(h_errs, 75))
            iqr = q3 - q1
            
            # Whiskers extend up to 1.5 * IQR from box
            low_bound = q1 - 1.5 * iqr
            high_bound = q3 + 1.5 * iqr
            
            in_range = h_errs[(h_errs >= low_bound) & (h_errs <= high_bound)]
            whisker_low = float(np.min(in_range)) if len(in_range) > 0 else q1
            whisker_high = float(np.max(in_range)) if len(in_range) > 0 else q3
            
            outliers = [float(round(x, 2)) for x in h_errs[(h_errs < low_bound) | (h_errs > high_bound)]]
            
            box_plots.append(HourlyBoxPlot(
                hour=h,
                label=label,
                sample_count=len(h_errs),
                median_mw=round(median, 2),
                q1_mw=round(q1, 2),
                q3_mw=round(q3, 2),
                iqr_mw=round(iqr, 2),
                whisker_low_mw=round(whisker_low, 2),
                whisker_high_mw=round(whisker_high, 2),
                outliers_mw=outliers[:10]  # Cap outliers for JSON efficiency
            ))
        return box_plots

    def _empty_metrics(self, start_date: str, end_date: str, gate_hour: int, hours_filter: str) -> QuantitativeMetricsResponse:
        return QuantitativeMetricsResponse(
            start_date=start_date,
            end_date=end_date,
            gate_closure_hour=gate_hour,
            hours_filter=hours_filter,
            total_evaluated_periods=0,
            mae_mw=0.0,
            rmse_mw=0.0,
            mean_bias_error_mw=0.0,
            wape_percent=0.0,
            correlation_r2=0.0,
            net_imbalance_gwh=0.0,
            bias_ratio=BiasRatio(pct_over_forecast=0.0, pct_under_forecast=0.0, pct_exact=0.0),
            max_over_forecast_mw=0.0,
            max_under_forecast_mw=0.0,
            peak_offpeak=PeakBreakdown(peak_mae_mw=0.0, peak_bias_mw=0.0, offpeak_mae_mw=0.0, offpeak_bias_mw=0.0),
            distribution_stats=DistributionStats(mean_mw=0.0, std_dev_mw=0.0, excess_kurtosis=0.0, pct_beyond_2sigma=0.0),
            error_distribution=[],
            hourly_box_plots=[]
        )
