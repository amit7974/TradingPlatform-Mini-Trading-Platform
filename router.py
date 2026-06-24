from fastapi import APIRouter
from app.api.endpoints import auth, market, trades, orders, stream

api_router = APIRouter()
api_router.include_router(auth.router,    prefix="/auth",    tags=["auth"])
api_router.include_router(market.router,  prefix="/market",  tags=["market"])
api_router.include_router(trades.router,  prefix="/trades",  tags=["trades"])
api_router.include_router(orders.router,  prefix="/orders",  tags=["orders"])
api_router.include_router(stream.router,  prefix="/stream",  tags=["stream"])
