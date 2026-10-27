import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db.repository import Repository
from app.api.v1.endpoints.forecasts import clear_forecast_cache
from app.api.v1.endpoints.metrics import clear_metrics_cache

@pytest.fixture
def client(tmp_path):
    clear_forecast_cache()
    clear_metrics_cache()
    with TestClient(app) as test_client:
        yield test_client

def test_health_endpoints(client):
    res1 = client.get("/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "online"
    
    res2 = client.get("/api/v1/health")
    assert res2.status_code == 200
    assert res2.json()["service"] == "GridBricks UK Wind Forecasting & Trading Platform"

def test_dates_endpoint(client):
    res = client.get("/api/v1/dates")
    assert res.status_code == 200
    data = res.json()
    assert "dates" in data
    assert "default_delivery_date" in data
    assert data["default_gate_closure_hour"] == 11

def test_forecasts_endpoint(client):
    # Test valid query
    res = client.get("/api/v1/forecasts?delivery_date=2026-01-15&gate_closure_hour=11&resolution=half_hour")
    assert res.status_code == 200
    data = res.json()
    assert data["delivery_date"] == "2026-01-15"
    assert data["decision_date"] == "2026-01-14"
    assert data["total_periods"] == 48
    assert len(data["periods"]) == 48
    
    # Test parameter validation (invalid resolution)
    res_bad = client.get("/api/v1/forecasts?delivery_date=2026-01-15&resolution=invalid_res")
    assert res_bad.status_code == 422

def test_metrics_endpoint(client):
    res = client.get("/api/v1/metrics?start_date=2026-01-01&end_date=2026-01-05&gate_closure_hour=11")
    assert res.status_code == 200
    data = res.json()
    assert "mae_mw" in data
    assert "rmse_mw" in data
    assert "mean_bias_error_mw" in data
    assert "wape_percent" in data
    assert "peak_offpeak" in data

def test_sync_status(client):
    res = client.get("/api/v1/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert "is_syncing" in data

def test_root_redirect(client):
    res = client.get("/", follow_redirects=False)
    assert res.status_code in (307, 302)
    assert res.headers["location"] == "/docs"
