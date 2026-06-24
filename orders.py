"""
Orders Endpoints
================
GET    /orders             – List recent orders
POST   /orders             – Place a new order
DELETE /orders/{id}        – Cancel a pending order
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.trade_service import trade_service

logger = logging.getLogger("trading.api.orders")
router = APIRouter()


class PlaceOrderRequest(BaseModel):
    symbol: str = Field(..., example="EURUSD")
    side: str = Field(..., example="BUY")           # BUY | SELL
    order_type: str = Field("MARKET", example="MARKET")  # MARKET | LIMIT | STOP
    quantity: float = Field(..., gt=0, example=10000)
    limit_price: Optional[float] = Field(None, example=1.0850)


@router.get("")
async def list_orders(limit: int = 50, db: AsyncSession = Depends(get_db)):
    orders = await trade_service.list_orders(db, limit)
    return {"orders": [o.to_dict() for o in orders]}


@router.post("", status_code=201)
async def place_order(req: PlaceOrderRequest, db: AsyncSession = Depends(get_db)):
    try:
        order = await trade_service.place_order(
            db=db,
            symbol=req.symbol,
            side=req.side,
            order_type=req.order_type,
            quantity=req.quantity,
            limit_price=req.limit_price,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return order.to_dict()


@router.delete("/{order_id}")
async def cancel_order(order_id: int, db: AsyncSession = Depends(get_db)):
    try:
        order = await trade_service.cancel_order(db, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not order:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found")
    return order.to_dict()
