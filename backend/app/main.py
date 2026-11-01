import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.db.database import init_db
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import health_check

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("windforecast.engine")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables and indexes exist
    logger.info("Initializing SQLite database engine and composite indexes...")
    init_db()
    logger.info(f"{settings.PROJECT_NAME} (v{settings.VERSION}) startup complete.")
    yield
    # Shutdown
    logger.info("Application shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
## Wind Forecast Desk: UK Wind Forecasting & Day-Ahead Evaluation Engine

A high-performance trading support system for UK energy utilities participating in the wholesale Day-Ahead electricity market.

### Key Capabilities:
* **Zero-Lookahead Alignment:** Evaluates forecasts strictly available prior to Gate Closure (default **11:00 GMT on D-1**).
* **Dual Temporal Resolutions:** Supports 30-min settlement periods (48 SP) and hourly aggregations (24 hr).
* **Vectorized Financial & Operational Metrics:** Sub-millisecond calculation of MAE, RMSE, Mean Bias Error (MBE), WAPE, Peak vs Off-Peak splits, and error distribution.
* **Low-Latency Storage:** High-concurrency SQLite with Write-Ahead Logging (WAL) and in-memory query caching.
    """,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Redirect root /docs to /api/docs
@app.get("/docs", include_in_schema=False)
def redirect_docs_to_api_docs():
    return RedirectResponse(url="/api/docs")

# Compression middleware for high-speed network delivery
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS configuration for seamless frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Health Check at root /health for cloud health probes (Render/Heroku/K8s)
app.add_api_route("/health", health_check, methods=["GET"], tags=["Health & Diagnostics"], include_in_schema=False)

# Mount Version 1 REST API
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
