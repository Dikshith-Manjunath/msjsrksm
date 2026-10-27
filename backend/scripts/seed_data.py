#!/usr/bin/env python3
import asyncio
import logging
import sys
from pathlib import Path

# Add backend to PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.db.database import init_db
from app.db.repository import Repository
from app.services.seeder import DataSeeder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("seed_data")

async def main():
    logger.info(f"Target database path: {settings.DATABASE_PATH}")
    init_db()
    repo = Repository()
    seeder = DataSeeder(repo)
    result = await seeder.seed_january_2026(force=True)
    logger.info(f"Seeder result: {result}")

if __name__ == "__main__":
    asyncio.run(main())
