"""
Application configuration – reads from environment variables with sensible defaults.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── ACT Trader API ────────────────────────────────────────────────────────
    ACT_AUTH_URL: str = "http://s138.acttrader.com:10138/api/v2/auth/token"
    ACT_WS_URL: str = "ws://s138.acttrader.com:22138/ws"

    # ── Internal auth ─────────────────────────────────────────────────────────
    SECRET_KEY: str = "trading-platform-dev-secret-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./trading.db"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # ── Throttling ────────────────────────────────────────────────────────────
    # Max price-update broadcasts per second per symbol to connected UI clients
    PRICE_THROTTLE_HZ: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
