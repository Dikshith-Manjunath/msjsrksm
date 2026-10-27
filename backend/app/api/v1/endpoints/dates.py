from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from app.core.config import settings
from app.db.repository import Repository

router = APIRouter()

def get_repo() -> Repository:
    return Repository()

@router.get("/dates", summary="Available Settlement Dates for January 2026")
def get_available_dates(repo: Repository = Depends(get_repo)) -> Dict[str, Any]:
    dates = repo.get_distinct_dates()
    default_date = settings.DEFAULT_DELIVERY_DATE if settings.DEFAULT_DELIVERY_DATE in dates else (dates[0] if dates else "2026-01-15")
    return {
        "dates": dates,
        "total_available_days": len(dates),
        "default_delivery_date": default_date,
        "default_gate_closure_hour": settings.DEFAULT_GATE_CLOSURE_HOUR
    }
