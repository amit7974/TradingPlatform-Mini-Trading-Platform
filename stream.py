"""
Stream Endpoint
===============
GET /stream/prices  – Server-Sent Events stream of throttled price updates.

The frontend opens ONE persistent SSE connection here. The backend pushes:
  - {"type":"price",      "symbol":…, "bid":…, "ask":…, "last":…, "timestamp":…}
  - {"type":"connection_status", "status": "connected"|"disconnected"|"reconnecting"}
  - {"type":"heartbeat"}   (every 15 s to keep the connection alive through proxies)

Throttling is applied upstream in MarketDataService before messages reach the queue.
"""
import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.market_data_service import market_data_service

logger = logging.getLogger("trading.api.stream")
router = APIRouter()

HEARTBEAT_INTERVAL = 15  # seconds


@router.get("/prices")
async def stream_prices():
    """
    SSE endpoint. Each message is formatted as:
      data: <json>\n\n
    """
    qid, queue = market_data_service.register_queue()

    async def event_generator():
        logger.info("SSE client connected (queue #%d)", qid)
        # Send current snapshot immediately so the UI isn't blank on connect
        snapshot = market_data_service.get_snapshot()
        for symbol, data in snapshot.items():
            payload = json.dumps({"type": "price", **data})
            yield f"data: {payload}\n\n"

        heartbeat_task = asyncio.create_task(_heartbeat(queue))
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    # Client still connected, send heartbeat
                    yield "data: {\"type\":\"heartbeat\"}\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("SSE stream error for queue #%d: %s", qid, exc)
        finally:
            heartbeat_task.cancel()
            market_data_service.unregister_queue(qid)
            logger.info("SSE client disconnected (queue #%d)", qid)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
            "Connection": "keep-alive",
        },
    )


async def _heartbeat(queue: asyncio.Queue):
    """Periodically inject heartbeat messages so the client knows we're alive."""
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        try:
            queue.put_nowait({"type": "heartbeat"})
        except asyncio.QueueFull:
            pass
