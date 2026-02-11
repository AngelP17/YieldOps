"""
Application Configuration

Environment-based configuration for the YieldOps API.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase
    SUPABASE_URL: str = "https://vwayvxcvkozxumezwqio.supabase.co"
    SUPABASE_SERVICE_KEY: str = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SECRET_KEY")
        or ""
    )
    SUPABASE_ANON_KEY: str = (
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
        or ""
    )
    
    # CORS
    # Comma-separated origins, e.g. "https://app.vercel.app,http://localhost:5173"
    CORS_ALLOW_ORIGINS: str = os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "https://yield-ops-dashboard.vercel.app,"
        "https://yieldops.vercel.app,"
        "https://yieldops-dashboard.vercel.app,"
        "https://transvec.vercel.app,"
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:3000",
    )
    CORS_ALLOW_ORIGIN_REGEX: str = os.environ.get(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"^https://([a-z0-9-]+\.)*vercel\.app$|^http://localhost(:\d+)?$|^http://127\.0\.0\.1(:\d+)?$",
    )
    
    # App
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "YieldOps API"
    VERSION: str = "1.0.0"
    
    # ML
    MODEL_PATH: str = "models/isolation_forest.pkl"
    AUTO_INIT_MODEL: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()


def get_cors_origins() -> list[str]:
    return [origin.strip() for origin in settings.CORS_ALLOW_ORIGINS.split(",") if origin.strip()]
