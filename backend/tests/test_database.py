import pytest
from app.db.database import init_db, get_connection
from app.db.repository import Repository

def test_database_init_and_pragmas(tmp_path):
    db_file = tmp_path / "test.db"
    init_db(db_file)
    
    conn = get_connection(db_file)
    mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
    assert mode.lower() == "wal"
    conn.close()

def test_repository_insert_and_lookahead_query(tmp_path):
    db_file = tmp_path / "test.db"
    init_db(db_file)
    repo = Repository(db_file)
    
    # 1. Insert Actuals
    actuals = [
        {"settlement_date": "2026-01-15", "settlement_period": 1, "start_time": "2026-01-15T00:00:00Z", "generation": 10500.0},
        {"settlement_date": "2026-01-15", "settlement_period": 2, "start_time": "2026-01-15T00:30:00Z", "generation": 10800.0},
    ]
    inserted_act = repo.insert_actuals_bulk(actuals)
    assert inserted_act == 2
    
    # Duplicate insert should be ignored
    assert repo.insert_actuals_bulk(actuals) == 0
    
    # Verify retrieval
    retrieved_act = repo.get_actuals_for_date("2026-01-15")
    assert len(retrieved_act) == 2
    assert retrieved_act[0]["generation"] == 10500.0
    
    # 2. Insert Forecasts (Simulate revision history)
    # Target period: 2026-01-15T00:00:00Z
    # Forecast A (published 2 days ahead): 9000 MW
    # Forecast B (published Day D-1 at 10:00 GMT - BEFORE Gate Closure): 9800 MW
    # Forecast C (published Day D-1 at 14:00 GMT - AFTER Gate Closure): 11000 MW
    forecasts = [
        {"start_time": "2026-01-15T00:00:00Z", "publish_time": "2026-01-13T10:00:00Z", "generation": 9000.0},
        {"start_time": "2026-01-15T00:00:00Z", "publish_time": "2026-01-14T10:00:00Z", "generation": 9800.0},
        {"start_time": "2026-01-15T00:00:00Z", "publish_time": "2026-01-14T14:00:00Z", "generation": 11000.0},
    ]
    inserted_fc = repo.insert_forecasts_bulk(forecasts)
    assert inserted_fc == 3
    
    # Query with Gate Closure at 11:00 GMT on Jan 14
    gate_closure_cutoff = "2026-01-14T11:00:00Z"
    fc_result = repo.get_forecasts_for_delivery_date("2026-01-15", gate_closure_cutoff)
    assert len(fc_result) == 1
    # Must pick Forecast B (9800 MW), NOT Forecast C (11000 MW) because C is after cutoff!
    assert fc_result[0]["generation"] == 9800.0
    assert fc_result[0]["publish_time"] == "2026-01-14T10:00:00Z"
    
    # Stats check
    stats = repo.get_database_stats()
    assert stats["actual_records"] == 2
    assert stats["forecast_records"] == 3
    assert stats["is_seeded"] is True
