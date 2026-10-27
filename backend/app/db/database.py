import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator
from app.core.config import settings

def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Create a high-performance SQLite connection configured for low-latency concurrent reads."""
    target_path = Path(db_path or settings.DATABASE_PATH)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(
        str(target_path),
        timeout=30.0,
        check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    
    # High-performance PRAGMAs for production throughput
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA cache_size = -64000;")       # 64 MB memory cache
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA mmap_size = 268435456;")     # 256 MB memory-mapped I/O
    conn.execute("PRAGMA foreign_keys = ON;")
    
    return conn

@contextmanager
def get_db(db_path: Path | str | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for acquiring and safely closing database connections."""
    conn = get_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()

def init_db(db_path: Path | str | None = None) -> None:
    """Initialize database tables, unique constraints, and composite indexes."""
    with get_db(db_path) as conn:
        with conn:
            # 1. Actual Generation Table (FUELHH - WIND)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS actual_generation (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    settlement_date TEXT NOT NULL,
                    settlement_period INTEGER NOT NULL,
                    start_time TEXT NOT NULL UNIQUE,
                    generation REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_actual_date 
                ON actual_generation (settlement_date);
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_actual_start_time 
                ON actual_generation (start_time);
            """)

            # 2. Forecast Generation Table (WINDFOR)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS forecast_generation (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    publish_time TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    generation REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(start_time, publish_time)
                );
            """)
            
            # Composite index for Day-Ahead lookup: find newest forecast before gate closure cutoff
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_forecast_lookup 
                ON forecast_generation (start_time, publish_time DESC);
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_forecast_publish 
                ON forecast_generation (publish_time);
            """)
