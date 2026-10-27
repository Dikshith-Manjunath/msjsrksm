from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.core.config import settings
from app.db.repository import Repository

router = APIRouter()

def get_repo() -> Repository:
    return Repository()

@router.get("/health", summary="Health & System Diagnostics")
def health_check(repo: Repository = Depends(get_repo)) -> Dict[str, Any]:
    stats = repo.get_database_stats()
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": {
            "path": str(settings.DATABASE_PATH),
            "actual_records": stats["actual_records"],
            "forecast_records": stats["forecast_records"],
            "min_date": stats["min_date"],
            "max_date": stats["max_date"],
            "is_seeded": stats["is_seeded"]
        }
    }
