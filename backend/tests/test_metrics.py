import pytest
import numpy as np
from app.db.database import init_db
from app.db.repository import Repository
from app.services.alignment import AlignmentService
from app.services.metrics import MetricsCalculator

@pytest.fixture
def populated_repo(tmp_path):
    db_file = tmp_path / "metrics_test.db"
    init_db(db_file)
    repo = Repository(db_file)
    
    # 4 periods on Jan 15:
    # SP 1: 00:00Z (Off-Peak) Actual = 1000, Forecast = 1100 -> error = +100
    # SP 2: 00:30Z (Off-Peak) Actual = 1000, Forecast = 800  -> error = -200
    # SP 15: 07:00Z (Peak)    Actual = 2000, Forecast = 2300 -> error = +300
    # SP 16: 07:30Z (Peak)    Actual = 2000, Forecast = 1600 -> error = -400
    repo.insert_actuals_bulk([
        {"settlement_date": "2026-01-15", "settlement_period": 1, "start_time": "2026-01-15T00:00:00Z", "generation": 1000.0},
        {"settlement_date": "2026-01-15", "settlement_period": 2, "start_time": "2026-01-15T00:30:00Z", "generation": 1000.0},
        {"settlement_date": "2026-01-15", "settlement_period": 15, "start_time": "2026-01-15T07:00:00Z", "generation": 2000.0},
        {"settlement_date": "2026-01-15", "settlement_period": 16, "start_time": "2026-01-15T07:30:00Z", "generation": 2000.0},
    ])
    
    repo.insert_forecasts_bulk([
        {"publish_time": "2026-01-14T10:00:00Z", "start_time": "2026-01-15T00:00:00Z", "generation": 1100.0},
        {"publish_time": "2026-01-14T10:00:00Z", "start_time": "2026-01-15T00:30:00Z", "generation": 800.0},
        {"publish_time": "2026-01-14T10:00:00Z", "start_time": "2026-01-15T07:00:00Z", "generation": 2300.0},
        {"publish_time": "2026-01-14T10:00:00Z", "start_time": "2026-01-15T07:30:00Z", "generation": 1600.0},
    ])
    return repo

def test_metrics_vectorized_accuracy(populated_repo):
    calc = MetricsCalculator(populated_repo)
    res = calc.calculate_metrics_for_range(
        start_date_str="2026-01-15",
        end_date_str="2026-01-15",
        gate_closure_hour=11,
        resolution="half_hour"
    )
    
    # 4 evaluated periods with valid data
    assert res.total_evaluated_periods == 4
    
    # MAE = (|100| + |-200| + |300| + |-400|) / 4 = 1000 / 4 = 250.0 MW
    assert res.mae_mw == 250.0
    
    # MBE = (100 - 200 + 300 - 400) / 4 = -200 / 4 = -50.0 MW
    assert res.mean_bias_error_mw == -50.0
    
    # RMSE = sqrt((100^2 + 200^2 + 300^2 + 400^2) / 4) = sqrt(75000) ~ 273.86
    assert abs(res.rmse_mw - 273.86) < 0.1
    
    # WAPE = sum(|err|) / sum(act) = 1000 / (1000 + 1000 + 2000 + 2000) = 1000 / 6000 * 100 = 16.67%
    assert abs(res.wape_percent - 16.67) < 0.05
    
    # Extreme values
    assert res.max_over_forecast_mw == 300.0
    assert res.max_under_forecast_mw == -400.0
    
    # Peak vs Off-Peak check:
    # Peak (07:00, 07:30): errors = [+300, -400] -> Peak MAE = 350.0, Peak Bias = -50.0
    assert res.peak_offpeak.peak_mae_mw == 350.0
    assert res.peak_offpeak.peak_bias_mw == -50.0
    
    # Off-Peak (00:00, 00:30): errors = [+100, -200] -> OffPeak MAE = 150.0, OffPeak Bias = -50.0
    assert res.peak_offpeak.offpeak_mae_mw == 150.0
    assert res.peak_offpeak.offpeak_bias_mw == -50.0
    
    # Advanced trading metrics check
    assert res.correlation_r2 >= 0.0
    assert res.net_imbalance_gwh == -0.1  # -200 MW * 0.5h / 1000 = -0.1 GWh
    assert res.bias_ratio.pct_over_forecast == 50.0  # 2 out of 4
    assert res.bias_ratio.pct_under_forecast == 50.0 # 2 out of 4
    assert len(res.hourly_box_plots) == 24
    assert res.distribution_stats.mean_mw == -50.0
