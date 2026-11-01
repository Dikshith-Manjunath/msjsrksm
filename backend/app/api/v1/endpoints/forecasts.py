from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any, Optional
from app.db.repository import Repository
from app.services.alignment import AlignmentService
from app.schemas.forecast import DayAheadForecastResponse

router = APIRouter()

# In-memory query cache for sub-millisecond repeated responses
_FORECAST_CACHE: Dict[str, DayAheadForecastResponse] = {}

def get_alignment_service() -> AlignmentService:
    repo = Repository()
    return AlignmentService(repo)

@router.get(
    "/forecasts", 
    response_model=DayAheadForecastResponse,
    summary="Day-Ahead Wind Forecast vs Actual Generation"
)
def get_forecasts(
    delivery_date: str = Query(
        "2026-01-15", 
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Target electricity delivery date (YYYY-MM-DD)"
    ),
    gate_closure_hour: int = Query(
        11, 
        ge=0, 
        le=23,
        description="Gate closure cutoff hour on D-1 in GMT (UK standard is 11:00 GMT)"
    ),
    resolution: str = Query(
        "half_hour", 
        pattern=r"^(half_hour|hour)$",
        description="'half_hour' (48 settlement periods) or 'hour' (24 hourly buckets)"
    ),
    interpolation: str = Query(
        "linear", 
        pattern=r"^(linear|step)$",
        description="Interpolation method for 30-min settlement periods ('linear' or 'step')"
    ),
    service: AlignmentService = Depends(get_alignment_service)
) -> DayAheadForecastResponse:
    cache_key = f"{delivery_date}_{gate_closure_hour}_{resolution}_{interpolation}"
    if cache_key in _FORECAST_CACHE:
        return _FORECAST_CACHE[cache_key]

    try:
        response = service.get_day_ahead_aligned_data(
            delivery_date_str=delivery_date,
            gate_closure_hour=gate_closure_hour,
            resolution=resolution,
            interpolation=interpolation
        )
        _FORECAST_CACHE[cache_key] = response
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to align day-ahead data: {str(e)}")

@router.get(
    "/forecasts/revisions",
    summary="Forecast Run Convergence & Revision History for a Settlement Period"
)
def get_forecast_revisions(
    start_time: str = Query(
        ...,
        description="Target settlement period start time (e.g. 2026-01-15T18:00:00Z)"
    ),
    cutoff: Optional[str] = Query(
        None,
        description="Optional gate closure cutoff timestamp to evaluate pre- vs post-cutoff runs"
    )
) -> Dict[str, Any]:
    repo = Repository()
    try:
        return repo.get_forecast_revisions_for_target(start_time, cutoff)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch forecast revisions: {str(e)}")

def clear_forecast_cache():
    _FORECAST_CACHE.clear()
