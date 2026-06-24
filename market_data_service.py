"""
Market Data Service
===================
Connects to the ACT Trader WebSocket, parses incoming price feed messages,
throttles updates at PRICE_THROTTLE_HZ, and fans out to subscribed async queues
(one per connected frontend client via the /ws SSE endpoint).

Architecture:
  ACT Trader WS ──► _ingest_loop()
                         │  raw message
                    _parse_message()
                         │  PriceUpdate dict
                    _throttle_cache  (per symbol, time-gated)
                         │  throttled updates
                    broadcast_queues (one asyncio.Queue per UI client)
"""
import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Any, Callable, Dict, Optional, Set

import websockets
from websockets.exceptions import ConnectionClosed, WebSocketException

from app.core.config import settings
from app.services.act_auth_service import act_auth_service

logger = logging.getLogger("trading.market_data")

# ── Types ─────────────────────────────────────────────────────────────────────
PriceUpdate = Dict[str, Any]
QueueId = int


class MarketDataService:
    """
    Singleton service that manages the single upstream WebSocket connection
    to ACT Trader and distributes throttled price updates to UI clients.
    """

    def __init__(self):
        self._ws: Optional[Any] = None
        self._task: Optional[asyncio.Task] = None
        self._running = False

        # symbol → latest raw price data
        self._latest: Dict[str, PriceUpdate] = {}

        # Throttle: symbol → last-broadcast timestamp
        self._last_broadcast: Dict[str, float] = defaultdict(float)
        self._throttle_interval: float = 1.0 / settings.PRICE_THROTTLE_HZ

        # Fan-out: id → asyncio.Queue
        self._queues: Dict[QueueId, asyncio.Queue] = {}
        self._next_queue_id = 0

        # Subscribed symbols (sent to ACT Trader as subscription messages)
        self.subscriptions: Set[str] = set()

        # Reconnection state
        self._reconnect_delay = 2.0
        self._max_reconnect_delay = 60.0

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and not getattr(self._ws, "closed", True)

    def register_queue(self) -> tuple[QueueId, asyncio.Queue]:
        """Register a new subscriber queue (called by each WebSocket client handler)."""
        qid = self._next_queue_id
        self._next_queue_id += 1
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._queues[qid] = q
        logger.info("Registered subscriber queue #%d (total: %d)", qid, len(self._queues))
        return qid, q

    def unregister_queue(self, qid: QueueId) -> None:
        self._queues.pop(qid, None)
        logger.info("Unregistered subscriber queue #%d (total: %d)", qid, len(self._queues))

    def get_snapshot(self) -> Dict[str, PriceUpdate]:
        """Return latest known prices for all symbols (used on client connect)."""
        return dict(self._latest)

    async def subscribe(self, symbol: str) -> None:
        """Add a symbol subscription and notify the upstream WS if connected."""
        self.subscriptions.add(symbol)
        if self._ws and not getattr(self._ws, "closed", True):
            await self._send_subscribe(symbol)

    async def unsubscribe(self, symbol: str) -> None:
        self.subscriptions.discard(symbol)
        if self._ws and not getattr(self._ws, "closed", True):
            await self._send_unsubscribe(symbol)

    async def connect(self) -> None:
        """Start the background ingestion task."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_with_reconnect(), name="market_data_ws")
        logger.info("Market data service started")

    async def disconnect(self) -> None:
        """Gracefully stop the ingestion task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._ws:
            await self._ws.close()
        logger.info("Market data service stopped")

    # ── Internal: reconnection loop ───────────────────────────────────────────

    async def _run_with_reconnect(self) -> None:
        """Outer loop that reconnects on any error with exponential back-off."""
        delay = self._reconnect_delay
        while self._running:
            try:
                await self._connect_and_ingest()
                delay = self._reconnect_delay  # reset on clean exit
            except asyncio.CancelledError:
                return
            except Exception as exc:
                if not self._running:
                    return
                logger.warning(
                    "WS connection lost (%s). Reconnecting in %.1fs…", exc, delay
                )
                await self._broadcast({"type": "connection_status", "status": "reconnecting"})
                await asyncio.sleep(delay)
                delay = min(delay * 2, self._max_reconnect_delay)

    async def _connect_and_ingest(self) -> None:
        """Acquire token, open WebSocket, subscribe, and ingest messages."""
        if not act_auth_service.has_credentials:
            logger.info("No ACT credentials yet – waiting…")
            await asyncio.sleep(5)
            return

        token = await act_auth_service.get_token()
        ws_url = f"{settings.ACT_WS_URL}?token={token}"
        logger.info("Connecting to ACT Trader WebSocket…")

        async with websockets.connect(
            ws_url,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            self._ws = ws
            logger.info("ACT Trader WebSocket connected ✓")
            await self._broadcast({"type": "connection_status", "status": "connected"})

            # Re-subscribe to all known symbols
            for sym in list(self.subscriptions):
                await self._send_subscribe(sym)

            async for raw in ws:
                if not self._running:
                    break
                await self._handle_raw(raw)

        self._ws = None
        await self._broadcast({"type": "connection_status", "status": "disconnected"})

    # ── Internal: message parsing ─────────────────────────────────────────────

    async def _handle_raw(self, raw: str) -> None:
        """Parse one raw WS message and forward throttled price updates."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.debug("Non-JSON WS message: %s", raw[:120])
            return

        update = self._parse_message(msg)
        if update:
            symbol = update["symbol"]
            self._latest[symbol] = update
            now = time.monotonic()
            if (now - self._last_broadcast[symbol]) >= self._throttle_interval:
                self._last_broadcast[symbol] = now
                await self._broadcast({"type": "price", **update})

    def _parse_message(self, msg: dict) -> Optional[PriceUpdate]:
        """
        Normalise ACT Trader message into a standard PriceUpdate dict.
        ACT Trader typically sends:
          { "Type": "Quote", "Symbol": "EURUSD", "Bid": 1.0850, "Ask": 1.0852, ... }
        We also handle generic tick / price message shapes.
        """
        msg_type = (msg.get("Type") or msg.get("type") or "").upper()

        # Quote / tick messages
        if msg_type in ("QUOTE", "TICK", "PRICE", "RATE"):
            symbol = (
                msg.get("Symbol") or msg.get("symbol") or
                msg.get("Instrument") or msg.get("instrument", "")
            ).upper()
            if not symbol:
                return None

            bid = float(msg.get("Bid") or msg.get("bid") or 0)
            ask = float(msg.get("Ask") or msg.get("ask") or 0)
            last = float(msg.get("Last") or msg.get("last") or msg.get("Close") or ((bid + ask) / 2 if bid and ask else 0))

            return {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "last": last,
                "spread": round(ask - bid, 5) if ask and bid else 0,
                "timestamp": msg.get("Time") or msg.get("timestamp") or time.time(),
            }

        # Server heartbeat – swallow silently
        if msg_type in ("HEARTBEAT", "PING", "PONG"):
            return None

        # Unknown – log for debugging
        logger.debug("Unhandled WS message type '%s': %s", msg_type, str(msg)[:200])
        return None

    # ── Internal: fan-out broadcast ───────────────────────────────────────────

    async def _broadcast(self, payload: dict) -> None:
        """Push payload to every registered subscriber queue (non-blocking)."""
        dead: list[QueueId] = []
        for qid, q in self._queues.items():
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                logger.debug("Queue #%d full – dropping oldest message", qid)
                try:
                    q.get_nowait()   # drop oldest
                    q.put_nowait(payload)
                except Exception:
                    dead.append(qid)
        for qid in dead:
            self._queues.pop(qid, None)

    # ── Internal: subscription messages ──────────────────────────────────────

    async def _send_subscribe(self, symbol: str) -> None:
        try:
            msg = json.dumps({"Type": "Subscribe", "Symbol": symbol})
            await self._ws.send(msg)
            logger.info("Subscribed to %s", symbol)
        except Exception as exc:
            logger.warning("Failed to subscribe to %s: %s", symbol, exc)

    async def _send_unsubscribe(self, symbol: str) -> None:
        try:
            msg = json.dumps({"Type": "Unsubscribe", "Symbol": symbol})
            await self._ws.send(msg)
            logger.info("Unsubscribed from %s", symbol)
        except Exception as exc:
            logger.warning("Failed to unsubscribe from %s: %s", symbol, exc)


# Singleton instance
market_data_service = MarketDataService()
