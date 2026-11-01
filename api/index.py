import sys
import os
import shutil
from pathlib import Path

# Locate project root and backend directory
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

# Ensure backend directory is first in sys.path
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure SQLite DB is ready in serverless /tmp environment if running on Vercel
if os.environ.get("VERCEL"):
    tmp_db = Path("/tmp/elexon_jan2026.db")
    if not tmp_db.exists():
        candidate_sources = [
            BACKEND_DIR / "data" / "elexon_jan2026.db",
            ROOT_DIR / "backend" / "data" / "elexon_jan2026.db",
            Path("backend/data/elexon_jan2026.db").resolve(),
            Path("/var/task/backend/data/elexon_jan2026.db"),
        ]
        for src in candidate_sources:
            if src.exists():
                tmp_db.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, tmp_db)
                break

from app.main import app
