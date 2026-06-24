"""
TradingPlatform Backend - FastAPI Application
Entry point for the trading platform backend service.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.database import init_db
from app.services.market_data_service import market_data_service

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("trading.main")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle manager."""
    logger.info("=== TradingPlatform Backend starting ===")
    await init_db()
    logger.info("Database initialised")
    yield
    logger.info("=== TradingPlatform Backend shutting down ===")
    await market_data_service.disconnect()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TradingPlatform API",
    description="Mini trading platform backend with live market-data streaming",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "ws_connected": market_data_service.is_connected,
        "subscriptions": list(market_data_service.subscriptions),
    }
