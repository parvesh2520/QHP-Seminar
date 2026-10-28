from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Virtual Fly Lab API"
    VERSION: str = "0.1.0"
    DEBUG: bool = False

    HOST: str = "127.0.0.1"
    PORT: int = 8000

    DATABASE_URL: str = "sqlite:///./virtual_fly_lab.db"

    # CORS origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    # Scientific computational limits
    MAX_SIMULATION_DURATION_MS: float = 5000.0
    MAX_INTEGRATION_STEPS: int = 100_000
    MAX_CANDIDATES_SCREEN: int = 200
    MAX_SUBGRAPH_DEPTH: int = 4
    MAX_SUBGRAPH_NODES: int = 300
    MAX_VOLTAGE_RECORD_NEURONS: int = 50

    # Storage paths
    DATA_DIR: Path = Path("./data_store")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
