import pytest
from app.db.database import init_db
from app.db.repository import Repository
from app.services.alignment import AlignmentService

@pytest.fixture
def test_repo(tmp_path):
    db_file = tmp_path / "alignment_test.db"
    init_db(db_file)
    repo = Repository(db_file)
    
    # Delivery date: 2026-01-15
    # Decision date: 2026-01-14
    # Actuals for hours 00:00 (SP 1, 2) and 01:00 (SP 3, 4)
    repo.insert_actuals_bulk([
        {"settlement_date": "2026-01-15", "settlement_period": 1, "start_time": "2026-01-15T00:00:00Z", "generation": 10000.0},
        {"settlement_date": "2026-01-15", "settlement_period": 2, "start_time": "2026-01-15T00:30:00Z", "generation": 10500.0},
        {"settlement_date": "2026-01-15", "settlement_period": 3, "start_time": "2026-01-15T01:00:00Z", "generation": 11000.0},
        {"settlement_date": "2026-01-15", "settlement_period": 4, "start_time": "2026-01-15T01:30:00Z", "generation": 11500.0},
    ])
    
    # Forecasts for 2026-01-15T00:00:00Z:
    # 1. Published 08:00 on Jan 14 (pre-cutoff) -> 9500 MW
    # 2. Published 10:30 on Jan 14 (pre-cutoff, newer) -> 9800 MW
    # 3. Published 13:00 on Jan 14 (post-cutoff) -> 12000 MW (cheating / lookahead)
    # Forecast for 2026-01-15T01:00:00Z:
    # 4. Published 10:30 on Jan 14 -> 10200 MW
    repo.insert_forecasts_bulk([
        {"publish_time": "2026-01-14T08:00:00Z", "start_time": "2026-01-15T00:00:00Z", "generation": 9500.0},
        {"publish_time": "2026-01-14T10:30:00Z", "start_time": "2026-01-15T00:00:00Z", "generation": 9800.0},
        {"publish_time": "2026-01-14T13:00:00Z", "start_time": "2026-01-15T00:00:00Z", "generation": 12000.0},
        {"publish_time": "2026-01-14T10:30:00Z", "start_time": "2026-01-15T01:00:00Z", "generation": 10200.0},
    ])
    return repo

def test_alignment_zero_lookahead_and_interpolation(test_repo):
    service = AlignmentService(test_repo)
    
    # Gate closure at 11:00 GMT on Jan 14
    resp = service.get_day_ahead_aligned_data(
        delivery_date_str="2026-01-15",
        gate_closure_hour=11,
        resolution="half_hour",
        interpolation="linear"
    )
    
    assert resp.delivery_date == "2026-01-15"
    assert resp.decision_date == "2026-01-14"
    assert resp.gate_closure_cutoff == "2026-01-14T11:00:00Z"
    assert resp.total_periods == 48
    
    # SP 1: 00:00Z
    sp1 = resp.periods[0]
    assert sp1.period_index == 1
    assert sp1.actual_mw == 10000.0
    # Must be 9800 MW (10:30 publication), NOT 12000 MW (13:00 post-cutoff publication)
    assert sp1.forecast_mw == 9800.0
    assert sp1.publish_time_used == "2026-01-14T10:30:00Z"
    assert sp1.error_mw == -200.0  # Under-forecast
    
    # SP 2: 00:30Z (interpolated between 00:00 [9800] and 01:00 [10200])
    sp2 = resp.periods[1]
    assert sp2.period_index == 2
    assert sp2.actual_mw == 10500.0
    expected_interpolated = round((9800.0 + 10200.0) / 2.0, 2)  # 10000.0
    assert sp2.forecast_mw == expected_interpolated
    assert sp2.error_mw == -500.0

def test_alignment_hourly_mode(test_repo):
    service = AlignmentService(test_repo)
    
    resp = service.get_day_ahead_aligned_data(
        delivery_date_str="2026-01-15",
        gate_closure_hour=11,
        resolution="hour"
    )
    
    assert resp.total_periods == 24
    # Hour 1 (00:00Z) actual must be mean of SP1 (10000) and SP2 (10500) -> 10250.0 MW
    h1 = resp.periods[0]
    assert h1.period_index == 1
    assert h1.start_time == "2026-01-15T00:00:00Z"
    assert h1.actual_mw == 10250.0
    assert h1.forecast_mw == 9800.0
    assert h1.error_mw == round(9800.0 - 10250.0, 2)
