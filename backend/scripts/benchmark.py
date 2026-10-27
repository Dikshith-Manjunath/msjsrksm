#!/usr/bin/env python3
import time
import sys
import statistics
import logging
from pathlib import Path
from starlette.testclient import TestClient

# Silence verbose loggers during benchmark
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("gridbricks.engine").setLevel(logging.WARNING)

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.db.database import init_db
from app.db.repository import Repository
from app.services.alignment import AlignmentService
from app.services.metrics import MetricsCalculator

def run_benchmark(num_requests: int = 100):
    print(f"\n=======================================================")
    print(f" GridBricks Engine: High-Performance Latency Benchmark ")
    print(f"=======================================================")
    
    init_db()
    repo = Repository()
    
    # Ensure test records exist
    if repo.get_database_stats()["actual_records"] == 0:
        actuals = []
        forecasts = []
        for sp in range(1, 49):
            hour = (sp - 1) * 30 // 60
            minute = (sp - 1) * 30 % 60
            iso_start = f"2026-01-15T{hour:02d}:{minute:02d}:00Z"
            actuals.append({
                "settlement_date": "2026-01-15",
                "settlement_period": sp,
                "start_time": iso_start,
                "generation": 12000.0 + (sp * 50)
            })
            if minute == 0:
                forecasts.append({
                    "publish_time": "2026-01-14T10:30:00Z",
                    "start_time": iso_start,
                    "generation": 11800.0 + (sp * 50)
                })
        repo.insert_actuals_bulk(actuals)
        repo.insert_forecasts_bulk(forecasts)

    # ----------------------------------------------------
    # Benchmark Layer 1: Raw Algorithmic Engine Latency
    # ----------------------------------------------------
    align_svc = AlignmentService(repo)
    calc_svc = MetricsCalculator(repo, align_svc)
    
    # Warmup
    align_svc.get_day_ahead_aligned_data("2026-01-15", 11, "half_hour", "linear")
    calc_svc.calculate_metrics_for_range("2026-01-15", "2026-01-15", 11, "half_hour")
    
    raw_alignment_lats = []
    for _ in range(num_requests):
        t0 = time.perf_counter()
        align_svc.get_day_ahead_aligned_data("2026-01-15", 11, "half_hour", "linear")
        raw_alignment_lats.append((time.perf_counter() - t0) * 1000.0)

    raw_metrics_lats = []
    for _ in range(num_requests):
        t0 = time.perf_counter()
        calc_svc.calculate_metrics_for_range("2026-01-15", "2026-01-15", 11, "half_hour")
        raw_metrics_lats.append((time.perf_counter() - t0) * 1000.0)

    # ----------------------------------------------------
    # Benchmark Layer 2: HTTP ASGI API Layer (with Middleware)
    # ----------------------------------------------------
    with TestClient(app) as client:
        # Warmup
        client.get("/api/v1/forecasts?delivery_date=2026-01-15&gate_closure_hour=11&resolution=half_hour")
        client.get("/api/v1/metrics?start_date=2026-01-15&end_date=2026-01-15&gate_closure_hour=11")
        
        http_forecast_lats = []
        for _ in range(num_requests):
            t0 = time.perf_counter()
            resp = client.get("/api/v1/forecasts?delivery_date=2026-01-15&gate_closure_hour=11&resolution=half_hour")
            assert resp.status_code == 200
            http_forecast_lats.append((time.perf_counter() - t0) * 1000.0)

        http_metrics_lats = []
        for _ in range(num_requests):
            t0 = time.perf_counter()
            resp = client.get("/api/v1/metrics?start_date=2026-01-15&end_date=2026-01-15&gate_closure_hour=11")
            assert resp.status_code == 200
            http_metrics_lats.append((time.perf_counter() - t0) * 1000.0)

    def print_section(title: str, lats: list[float]):
        mean_l = statistics.mean(lats)
        p50 = statistics.median(lats)
        p95 = statistics.quantiles(lats, n=20)[18] if len(lats) >= 20 else max(lats)
        rps = 1000.0 / mean_l if mean_l > 0 else 0
        print(f"\n{title}")
        print(f"  • Samples:          {len(lats)}")
        print(f"  • Mean Latency:     {mean_l:.2f} ms")
        print(f"  • Median (p50):     {p50:.2f} ms")
        print(f"  • 95th %ile (p95):  {p95:.2f} ms")
        print(f"  • Min / Max:        {min(lats):.2f} ms / {max(lats):.2f} ms")
        print(f"  • Throughput:       ~{rps:,.0f} req/sec per core")

    print_section("[Layer 1] Core SQLite Alignment Engine (48 SP)", raw_alignment_lats)
    print_section("[Layer 1] Vectorized NumPy Metrics Engine", raw_metrics_lats)
    print_section("[Layer 2] HTTP ASGI Endpoint: GET /api/v1/forecasts", http_forecast_lats)
    print_section("[Layer 2] HTTP ASGI Endpoint: GET /api/v1/metrics", http_metrics_lats)
    
    p95_raw = statistics.quantiles(raw_alignment_lats, n=20)[18]
    print(f"\n=======================================================")
    print(f" [PASS] Benchmark Complete: Core engine executes at p95 of {p95_raw:.2f} ms!")
    print(f"=======================================================\n")

if __name__ == "__main__":
    run_benchmark(num_requests=100)
