import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.services.elexon_client import ElexonClient
from app.services.seeder import DataSeeder
from app.db.database import init_db
from app.db.repository import Repository

@pytest.mark.asyncio
async def test_fetch_fuelhh_wind_stream_parsing():
    client = ElexonClient()
    mock_payload = [
        {"fuelType": "BIOMASS", "generation": 1500, "startTime": "2026-01-01T00:00:00Z"},
        {"fuelType": "WIND", "generation": 12450.5, "startTime": "2026-01-01T00:00:00Z", "settlementDate": "2026-01-01", "settlementPeriod": 1},
        {"fuelType": "NUCLEAR", "generation": 5000, "startTime": "2026-01-01T00:00:00Z"}
    ]
    
    mock_response = httpx.Response(200, json=mock_payload, request=httpx.Request("GET", "https://test.url"))
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        records = await client.fetch_fuelhh_wind_stream("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
        
    assert len(records) == 1
    assert records[0]["generation"] == 12450.5
    assert records[0]["settlement_period"] == 1
    assert records[0]["start_time"] == "2026-01-01T00:00:00Z"

@pytest.mark.asyncio
async def test_fetch_windfor_stream_parsing():
    client = ElexonClient()
    mock_payload = [
        {"dataset": "WINDFOR", "publishTime": "2026-01-01T02:30:00Z", "startTime": "2026-01-01T05:00:00Z", "generation": 14000.0}
    ]
    
    mock_response = httpx.Response(200, json=mock_payload, request=httpx.Request("GET", "https://test.url"))
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        records = await client.fetch_windfor_stream("2026-01-01T00:00:00Z", "2026-01-01T03:00:00Z")
        
    assert len(records) == 1
    assert records[0]["generation"] == 14000.0
    assert records[0]["publish_time"] == "2026-01-01T02:30:00Z"
    assert records[0]["start_time"] == "2026-01-01T05:00:00Z"

@pytest.mark.asyncio
async def test_seeder_lifecycle(tmp_path):
    db_file = tmp_path / "seed_test.db"
    init_db(db_file)
    repo = Repository(db_file)
    
    # Mock client returning 2 actuals and 2 forecasts
    mock_client = AsyncMock(spec=ElexonClient)
    mock_client.fetch_range_in_chunks.side_effect = [
        [
            {"settlement_date": "2026-01-01", "settlement_period": 1, "start_time": "2026-01-01T00:00:00Z", "generation": 11000.0},
            {"settlement_date": "2026-01-01", "settlement_period": 2, "start_time": "2026-01-01T00:30:00Z", "generation": 11200.0}
        ],
        [
            {"publish_time": "2025-12-31T10:00:00Z", "start_time": "2026-01-01T00:00:00Z", "generation": 10800.0},
            {"publish_time": "2025-12-31T10:00:00Z", "start_time": "2026-01-01T01:00:00Z", "generation": 11500.0}
        ]
    ]
    
    seeder = DataSeeder(repo, mock_client)
    res = await seeder.seed_january_2026()
    assert res["status"] == "seeded_successfully"
    assert res["actual_records"] == 2
    assert res["forecast_records"] == 2
    
    # Second call should skip because already seeded
    res2 = await seeder.seed_january_2026(force=False)
    assert res2["status"] == "already_seeded"
