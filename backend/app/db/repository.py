import sqlite3
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.db.database import get_db

class Repository:
    def __init__(self, db_path: Optional[Path | str] = None):
        self.db_path = db_path

    def insert_actuals_bulk(self, records: List[Dict[str, Any]]) -> int:
        """Bulk insert actual generation records, ignoring duplicates."""
        if not records:
            return 0
        with get_db(self.db_path) as conn:
            with conn:
                cursor = conn.executemany("""
                    INSERT OR IGNORE INTO actual_generation (
                        settlement_date, settlement_period, start_time, generation
                    ) VALUES (
                        :settlement_date, :settlement_period, :start_time, :generation
                    );
                """, records)
                return cursor.rowcount

    def insert_forecasts_bulk(self, records: List[Dict[str, Any]]) -> int:
        """Bulk insert forecast records, ignoring duplicates."""
        if not records:
            return 0
        with get_db(self.db_path) as conn:
            with conn:
                cursor = conn.executemany("""
                    INSERT OR IGNORE INTO forecast_generation (
                        publish_time, start_time, generation
                    ) VALUES (
                        :publish_time, :start_time, :generation
                    );
                """, records)
                return cursor.rowcount

    def get_actuals_for_date(self, delivery_date: str) -> List[Dict[str, Any]]:
        """Fetch all 48 settlement periods of actual wind generation for a delivery date."""
        with get_db(self.db_path) as conn:
            rows = conn.execute("""
                SELECT settlement_date, settlement_period, start_time, generation
                FROM actual_generation
                WHERE settlement_date = ?
                ORDER BY settlement_period ASC;
            """, (delivery_date,)).fetchall()
            return [dict(row) for row in rows]

    def get_forecasts_for_delivery_date(
        self, 
        delivery_date: str, 
        gate_closure_cutoff: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch the latest forecast published ON OR BEFORE gate_closure_cutoff 
        for each target interval occurring on delivery_date.
        Strictly prevents lookahead bias.
        """
        start_time_pattern = f"{delivery_date}%"
        with get_db(self.db_path) as conn:
            # Subquery finds maximum publish_time <= gate_closure_cutoff for each start_time
            rows = conn.execute("""
                WITH latest_valid_publish AS (
                    SELECT 
                        start_time, 
                        MAX(publish_time) AS max_pub_time
                    FROM forecast_generation
                    WHERE start_time LIKE ? 
                      AND publish_time <= ?
                    GROUP BY start_time
                )
                SELECT 
                    f.start_time,
                    f.publish_time,
                    f.generation
                FROM forecast_generation f
                JOIN latest_valid_publish l
                  ON f.start_time = l.start_time 
                 AND f.publish_time = l.max_pub_time
                ORDER BY f.start_time ASC;
            """, (start_time_pattern, gate_closure_cutoff)).fetchall()
            return [dict(row) for row in rows]

    def get_distinct_dates(self) -> List[str]:
        """Fetch all available settlement dates present in actual generation."""
        with get_db(self.db_path) as conn:
            rows = conn.execute("""
                SELECT DISTINCT settlement_date 
                FROM actual_generation 
                ORDER BY settlement_date ASC;
            """).fetchall()
            return [row["settlement_date"] for row in rows]

    def get_database_stats(self) -> Dict[str, Any]:
        """Return table record counts, min/max dates, and status."""
        with get_db(self.db_path) as conn:
            actual_count = conn.execute("SELECT COUNT(*) as count FROM actual_generation;").fetchone()["count"]
            forecast_count = conn.execute("SELECT COUNT(*) as count FROM forecast_generation;").fetchone()["count"]
            date_range = conn.execute("""
                SELECT 
                    MIN(settlement_date) as min_date, 
                    MAX(settlement_date) as max_date 
                FROM actual_generation;
            """).fetchone()
            return {
                "actual_records": actual_count,
                "forecast_records": forecast_count,
                "min_date": date_range["min_date"],
                "max_date": date_range["max_date"],
                "is_seeded": actual_count > 0 and forecast_count > 0
            }
