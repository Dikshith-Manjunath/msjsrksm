import logging
import asyncio
from typing import Dict, Any
from app.db.repository import Repository
from app.services.elexon_client import ElexonClient

logger = logging.getLogger(__name__)

class DataSeeder:
    """Manages initial seeding and on-demand synchronization of January 2026 Elexon data."""
    
    def __init__(self, repo: Repository, client: ElexonClient | None = None):
        self.repo = repo
        self.client = client or ElexonClient()

    async def seed_january_2026(self, force: bool = False) -> Dict[str, Any]:
        """
        Seeds all actual wind generation and forecasts for January 2026 into SQLite.
        Skips if already seeded unless force=True.
        """
        stats = self.repo.get_database_stats()
        if stats["is_seeded"] and not force:
            logger.info("Database already seeded with January 2026 data. Skipping.")
            return {
                "status": "already_seeded",
                "actual_records": stats["actual_records"],
                "forecast_records": stats["forecast_records"],
                "min_date": stats["min_date"],
                "max_date": stats["max_date"]
            }

        logger.info("Starting ingestion of January 2026 Elexon data...")
        
        # 1. Fetch Actuals for January 2026 (Jan 1 00:00 to Feb 1 00:30)
        # We chunk in 7-day intervals for fast streaming
        actual_records = await self.client.fetch_range_in_chunks(
            fetch_type="FUELHH",
            start_date="2026-01-01T00:00:00Z",
            end_date="2026-02-01T00:30:00Z",
            chunk_days=7
        )
        inserted_actuals = self.repo.insert_actuals_bulk(actual_records)
        logger.info(f"Inserted {inserted_actuals} actual wind records.")

        # 2. Fetch Forecasts covering January 2026 decisions
        # Forecasts begin Dec 30, 2025 (for Jan 1 delivery decisions made on Dec 31)
        forecast_records = await self.client.fetch_range_in_chunks(
            fetch_type="WINDFOR",
            start_date="2025-12-30T00:00:00Z",
            end_date="2026-02-01T00:00:00Z",
            chunk_days=5
        )
        inserted_forecasts = self.repo.insert_forecasts_bulk(forecast_records)
        logger.info(f"Inserted {inserted_forecasts} wind forecast records.")

        updated_stats = self.repo.get_database_stats()
        return {
            "status": "seeded_successfully",
            "actual_records": updated_stats["actual_records"],
            "forecast_records": updated_stats["forecast_records"],
            "min_date": updated_stats["min_date"],
            "max_date": updated_stats["max_date"]
        }
