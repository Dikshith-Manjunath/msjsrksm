from fastapi import APIRouter
from app.api.v1.endpoints import health, dates, forecasts, metrics, sync

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(dates.router, tags=["Dates"])
api_router.include_router(forecasts.router, tags=["Day-Ahead Forecasts"])
api_router.include_router(metrics.router, tags=["Quantitative Metrics"])
api_router.include_router(sync.router, tags=["Data Synchronization"])
