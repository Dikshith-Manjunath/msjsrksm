from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any
from app.db.repository import Repository
from app.services.metrics import MetricsCalculator
from app.schemas.metric import QuantitativeMetricsResponse

router = APIRouter()

# In-memory query cache for metrics
_METRICS_CACHE: Dict[str, QuantitativeMetricsResponse] = {}

def get_metrics_calculator() -> MetricsCalculator:
    repo = Repository()
    return MetricsCalculator(repo)

@router.get(
    "/metrics", 
    response_model=QuantitativeMetricsResponse,
    summary="Quantitative Forecast Accuracy Evaluation (MAE, RMSE, Bias, WAPE)"
)
def get_metrics(
    start_date: str = Query(
        "2026-01-01", 
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Start delivery date for evaluation (YYYY-MM-DD)"
    ),
    end_date: str = Query(
        "2026-01-31", 
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="End delivery date for evaluation (YYYY-MM-DD)"
    ),
    gate_closure_hour: int = Query(
        11, 
        ge=0, 
        le=23,
        description="Gate closure cutoff hour on D-1 in GMT"
    ),
    resolution: str = Query(
        "half_hour", 
        pattern=r"^(half_hour|hour)$",
        description="Temporal resolution ('half_hour' or 'hour')"
    ),
    calculator: MetricsCalculator = Depends(get_metrics_calculator)
) -> QuantitativeMetricsResponse:
    cache_key = f"{start_date}_{end_date}_{gate_closure_hour}_{resolution}"
    if cache_key in _METRICS_CACHE:
        return _METRICS_CACHE[cache_key]

    try:
        response = calculator.calculate_metrics_for_range(
            start_date_str=start_date,
            end_date_str=end_date,
            gate_closure_hour=gate_closure_hour,
            resolution=resolution
        )
        _METRICS_CACHE[cache_key] = response
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate metrics: {str(e)}")

def clear_metrics_cache():
    _METRICS_CACHE.clear()
