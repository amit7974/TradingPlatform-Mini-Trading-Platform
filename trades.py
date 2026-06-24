"""
Trades Endpoints
================
GET    /trades          – List all trades
GET    /trades/{id}     – Get single trade
POST   /trades/{id}/close – Close an open trade at market
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.trade_service import trade_service

logger = logging.getLogger("trading.api.trades")
router = APIRouter()


@router.get("")
async def list_trades(limit: int = 100, db: AsyncSession = Depends(get_db)):
    trades = await trade_service.list_trades(db, limit)
    return {"trades": [t.to_dict() for t in trades]}


@router.get("/{trade_id}")
async def get_trade(trade_id: int, db: AsyncSession = Depends(get_db)):
    trade = await trade_service.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail=f"Trade #{trade_id} not found")
    return trade.to_dict()


@router.post("/{trade_id}/close")
async def close_trade(trade_id: int, db: AsyncSession = Depends(get_db)):
    try:
        trade = await trade_service.close_trade(db, trade_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return trade.to_dict()
