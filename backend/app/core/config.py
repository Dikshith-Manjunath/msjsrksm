import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")
    
    PROJECT_NAME: str = "Wind Forecast Desk: UK Wind Forecasting & Trading Platform"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    DATABASE_PATH: Path = DATA_DIR / "elexon_jan2026.db"
    
    # Elexon BMRS API Endpoints
    ELEXON_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
    FUELHH_ENDPOINT: str = f"{ELEXON_BASE_URL}/FUELHH/stream"
    WINDFOR_ENDPOINT: str = f"{ELEXON_BASE_URL}/WINDFOR/stream"
    
    # Trading Defaults
    DEFAULT_GATE_CLOSURE_HOUR: int = 11  # 11:00 GMT on D-1
    DEFAULT_DELIVERY_DATE: str = "2026-01-15"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

settings = Settings()
