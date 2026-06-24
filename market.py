"""
Market Data Endpoints
=====================
GET  /market/snapshot      – Latest prices for all subscribed symbols
POST /market/subscribe     – Subscribe to a symbol
DELETE /market/subscribe/{symbol} – Unsubscribe
GET  /market/symbols       – List of default watchlist symbols
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.market_data_service import market_data_service

logger = logging.getLogger("trading.api.market")
router = APIRouter()

# Default symbols to show in the watchlist
DEFAULT_SYMBOLS = [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF",
    "AUDUSD", "USDCAD", "NZDUSD", "EURGBP",
    "XAUUSD", "XAGUSD",
]


class SubscribeRequest(BaseModel):
    symbol: str


@router.get("/snapshot")
async def get_snapshot():
    """Return latest throttled prices for all subscribed symbols."""
    return {
        "prices": market_data_service.get_snapshot(),
        "subscriptions": list(market_data_service.subscriptions),
    }


@router.get("/symbols")
async def get_symbols():
    return {"symbols": DEFAULT_SYMBOLS}


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest):
    symbol = req.symbol.upper()
    await market_data_service.subscribe(symbol)
    return {"subscribed": symbol, "all": list(market_data_service.subscriptions)}


@router.delete("/subscribe/{symbol}")
async def unsubscribe(symbol: str):
    symbol = symbol.upper()
    await market_data_service.unsubscribe(symbol)
    return {"unsubscribed": symbol, "all": list(market_data_service.subscriptions)}
