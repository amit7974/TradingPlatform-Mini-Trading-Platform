"""
Trade Service
=============
Business logic for order placement, trade execution simulation,
P&L calculation, and trade/order lifecycle management.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderSide, OrderStatus, OrderType
from app.models.trade import Trade, TradeDirection
from app.services.market_data_service import market_data_service

logger = logging.getLogger("trading.trade_service")


class TradeService:
    """Stateless service – all state lives in the database."""

    # ── Orders ─────────────────────────────────────────────────────────────────

    async def place_order(
        self,
        db: AsyncSession,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        limit_price: Optional[float] = None,
    ) -> Order:
        """Create an order and immediately simulate execution for MARKET orders."""
        symbol = symbol.upper()

        order = Order(
            symbol=symbol,
            side=OrderSide(side.upper()),
            order_type=OrderType(order_type.upper()),
            quantity=quantity,
            limit_price=limit_price,
            status=OrderStatus.PENDING,
        )
        db.add(order)
        await db.flush()  # get order.id without committing

        if order.order_type == OrderType.MARKET:
            trade = await self._fill_market_order(db, order)
            if trade:
                order.status = OrderStatus.FILLED
                order.fill_price = trade.price
                order.trade_id = trade.id
                logger.info(
                    "MARKET order #%d filled: %s %s x%.2f @ %.5f",
                    order.id, order.side, symbol, quantity, trade.price,
                )
            else:
                order.status = OrderStatus.REJECTED
                order.fill_price = None
                logger.warning("MARKET order #%d rejected – no price available for %s", order.id, symbol)
        else:
            logger.info(
                "LIMIT/STOP order #%d created: %s %s x%.2f @ %.5f",
                order.id, order.side, symbol, quantity, limit_price or 0,
            )

        await db.commit()
        return order

    async def cancel_order(self, db: AsyncSession, order_id: int) -> Optional[Order]:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            return None
        if order.status != OrderStatus.PENDING:
            raise ValueError(f"Order #{order_id} is not PENDING (status={order.status})")
        order.status = OrderStatus.CANCELLED
        await db.commit()
        logger.info("Order #%d cancelled", order_id)
        return order

    async def list_orders(self, db: AsyncSession, limit: int = 50):
        result = await db.execute(
            select(Order).order_by(desc(Order.created_at)).limit(limit)
        )
        return result.scalars().all()

    # ── Trades ─────────────────────────────────────────────────────────────────

    async def close_trade(self, db: AsyncSession, trade_id: int) -> Trade:
        """Close an open trade at current market price and realise P&L."""
        result = await db.execute(select(Trade).where(Trade.id == trade_id))
        trade = result.scalar_one_or_none()
        if not trade:
            raise ValueError(f"Trade #{trade_id} not found")
        if trade.status != "OPEN":
            raise ValueError(f"Trade #{trade_id} is already {trade.status}")

        close_price = self._get_current_price(trade.symbol, trade.direction)
        if close_price is None:
            raise ValueError(f"No live price available for {trade.symbol}")

        pnl = self._calculate_pnl(trade, close_price)
        trade.close_price = close_price
        trade.pnl = pnl
        trade.status = "CLOSED"
        trade.closed_at = datetime.now(timezone.utc)

        await db.commit()
        logger.info(
            "Trade #%d closed: %s %s @ %.5f  P&L: %.2f",
            trade.id, trade.symbol, trade.direction, close_price, pnl,
        )
        return trade

    async def list_trades(self, db: AsyncSession, limit: int = 100):
        result = await db.execute(
            select(Trade).order_by(desc(Trade.opened_at)).limit(limit)
        )
        return result.scalars().all()

    async def get_trade(self, db: AsyncSession, trade_id: int) -> Optional[Trade]:
        result = await db.execute(select(Trade).where(Trade.id == trade_id))
        return result.scalar_one_or_none()

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _fill_market_order(self, db: AsyncSession, order: Order) -> Optional[Trade]:
        """Simulate immediate fill at current bid/ask."""
        price = self._get_current_price(order.symbol, order.side.value)
        if price is None:
            return None

        direction = TradeDirection.BUY if order.side == OrderSide.BUY else TradeDirection.SELL
        trade = Trade(
            symbol=order.symbol,
            direction=direction,
            quantity=order.quantity,
            price=price,
            status="OPEN",
        )
        db.add(trade)
        await db.flush()
        return trade

    def _get_current_price(self, symbol: str, side) -> Optional[float]:
        """
        Return execution price for a given side:
          BUY  → ask (you pay the offer)
          SELL → bid (you receive the bid)
        """
        snapshot = market_data_service.get_snapshot()
        data = snapshot.get(symbol.upper())
        if not data:
            logger.warning("No market data snapshot for %s", symbol)
            return None

        side_str = side.upper() if hasattr(side, "upper") else str(side).upper()
        if side_str in ("BUY", "BID"):
            return data.get("ask") or data.get("last")
        else:
            return data.get("bid") or data.get("last")

    @staticmethod
    def _calculate_pnl(trade: Trade, close_price: float) -> float:
        """Simple pip-based P&L: (close - open) × qty × direction_sign."""
        sign = 1.0 if trade.direction == TradeDirection.BUY else -1.0
        return round(sign * (close_price - trade.price) * trade.quantity, 2)


trade_service = TradeService()
