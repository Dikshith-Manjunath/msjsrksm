import asyncio
import logging
from fastapi import APIRouter, BackgroundTasks, Query
from typing import Dict, Any
from app.db.repository import Repository
from app.services.seeder import DataSeeder
from app.api.v1.endpoints.forecasts import clear_forecast_cache
from app.api.v1.endpoints.metrics import clear_metrics_cache

logger = logging.getLogger(__name__)
router = APIRouter()

_SYNC_STATUS = {
    "is_syncing": False,
    "last_synced_at": None,
    "last_result": None
}

async def _run_sync(force: bool):
    global _SYNC_STATUS
    _SYNC_STATUS["is_syncing"] = True
    repo = Repository()
    seeder = DataSeeder(repo)
    try:
        res = await seeder.seed_january_2026(force=force)
        clear_forecast_cache()
        clear_metrics_cache()
        _SYNC_STATUS["last_result"] = res
        _SYNC_STATUS["last_synced_at"] = res.get("status")
    except Exception as e:
        logger.error(f"Background sync failed: {e}")
        _SYNC_STATUS["last_result"] = {"error": str(e)}
    finally:
        _SYNC_STATUS["is_syncing"] = False

@router.post("/sync", summary="Trigger On-Demand Elexon BMRS Data Synchronization")
def trigger_sync(
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="Force re-fetch even if data exists")
) -> Dict[str, Any]:
    if _SYNC_STATUS["is_syncing"]:
        return {"status": "sync_in_progress", "message": "A synchronization job is already running."}
    
    background_tasks.add_task(_run_sync, force)
    return {
        "status": "sync_triggered",
        "message": "Elexon BMRS data ingestion running in background."
    }

@router.get("/sync/status", summary="Check Synchronization Status")
def get_sync_status() -> Dict[str, Any]:
    return _SYNC_STATUS
