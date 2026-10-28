import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

class ElexonClient:
    """Async streaming client for Elexon BMRS API with connection pooling and chunked fetching."""
    
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self.headers = {
            "Accept": "application/json",
            "User-Agent": "WindForecastDesk-Engine/0.1.0"
        }

    async def fetch_fuelhh_wind_stream(
        self, 
        publish_from: str, 
        publish_to: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch actual generation stream from FUELHH and filter strictly for fuelType == 'WIND'.
        Dates must be ISO-8601 strings, e.g., '2026-01-01T00:00:00Z'.
        """
        params = {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    settings.FUELHH_ENDPOINT,
                    params=params,
                    headers=self.headers
                )
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"Error fetching FUELHH stream ({publish_from} to {publish_to}): {e}")
                raise

        wind_records: List[Dict[str, Any]] = []
        for item in data:
            if item.get("fuelType") == "WIND":
                # Ensure all required fields exist
                if "startTime" in item and "generation" in item:
                    wind_records.append({
                        "settlement_date": item.get("settlementDate") or item["startTime"][:10],
                        "settlement_period": item.get("settlementPeriod", 0),
                        "start_time": item["startTime"],
                        "generation": float(item["generation"])
                    })
        return wind_records

    async def fetch_windfor_stream(
        self, 
        publish_from: str, 
        publish_to: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch forecasted wind generation stream from WINDFOR.
        Dates must be ISO-8601 strings, e.g., '2026-01-01T00:00:00Z'.
        """
        params = {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    settings.WINDFOR_ENDPOINT,
                    params=params,
                    headers=self.headers
                )
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"Error fetching WINDFOR stream ({publish_from} to {publish_to}): {e}")
                raise

        forecast_records: List[Dict[str, Any]] = []
        for item in data:
            if "startTime" in item and "publishTime" in item and "generation" in item:
                forecast_records.append({
                    "publish_time": item["publishTime"],
                    "start_time": item["startTime"],
                    "generation": float(item["generation"])
                })
        return forecast_records

    async def fetch_range_in_chunks(
        self, 
        fetch_type: str, 
        start_date: str, 
        end_date: str, 
        chunk_days: int = 5
    ) -> List[Dict[str, Any]]:
        """Fetch a wide date range by breaking it into smaller chunks to avoid API timeouts."""
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        
        all_records: List[Dict[str, Any]] = []
        current_dt = start_dt
        
        while current_dt < end_dt:
            next_dt = min(current_dt + timedelta(days=chunk_days), end_dt)
            from_str = current_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            to_str = next_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            logger.info(f"Ingesting {fetch_type} chunk: {from_str} to {to_str}")
            if fetch_type == "FUELHH":
                records = await self.fetch_fuelhh_wind_stream(from_str, to_str)
            else:
                records = await self.fetch_windfor_stream(from_str, to_str)
                
            all_records.extend(records)
            current_dt = next_dt
            
        return all_records
