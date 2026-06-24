"""
Trade model – represents an executed fill (buy/sell confirmation).
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from app.db.database import Base
import enum


class TradeDirection(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    direction = Column(Enum(TradeDirection), nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    pnl = Column(Float, default=0.0)          # realised P&L at close
    status = Column(String(20), default="OPEN")  # OPEN | CLOSED
    opened_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime, nullable=True)
    close_price = Column(Float, nullable=True)
    notes = Column(String(255), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "direction": self.direction,
            "quantity": self.quantity,
            "price": self.price,
            "pnl": self.pnl,
            "status": self.status,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "close_price": self.close_price,
            "notes": self.notes,
        }
