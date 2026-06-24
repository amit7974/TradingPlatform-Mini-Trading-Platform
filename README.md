# TradingPlatform — Mini Trading Platform

A full-stack trading dashboard integrating the ACT Trader live market data API with a clean, production-quality backend and responsive frontend.

---

## Quick Start

**Terminal 1 — Backend:**
```bash
bash start_backend.sh
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

**Terminal 2 — Frontend:**
```bash
bash start_frontend.sh
# → http://localhost:5173
```

Open `http://localhost:5173`, enter your ACT Trader credentials, and the platform connects live.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │Watchlist │  │  PriceChart  │  │OrderTicket │  │Positions │ │
│  │(flash UI)│  │  (Recharts)  │  │(BUY/SELL)  │  │& Orders  │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│       │               │ SSE stream      │ REST calls   │       │
└───────┼───────────────┼─────────────────┼──────────────┼───────┘
        │               │                 │              │
┌───────▼───────────────▼─────────────────▼──────────────▼───────┐
│                    FastAPI Backend (:8000)                       │
│                                                                  │
│  POST /api/v1/auth/login      ← ACT Trader REST auth            │
│  GET  /api/v1/stream/prices   ← SSE fan-out (throttled 5 Hz)    │
│  POST /api/v1/orders          ← Place order → fills trade        │
│  POST /api/v1/trades/{id}/close ← Close position                │
│  GET  /api/v1/market/snapshot ← Latest price snapshot           │
│                                                                  │
│  ┌───────────────┐    ┌──────────────────────────────────────┐  │
│  │ ActAuthService│    │       MarketDataService              │  │
│  │               │    │  - Single upstream WS connection     │  │
│  │ Caches token  │    │  - Auto-reconnect w/ backoff         │  │
│  │ Auto-refreshes│    │  - Throttle: 5 Hz per symbol         │  │
│  │ before expiry │    │  - Fan-out to N SSE subscriber queues│  │
│  └───────┬───────┘    └───────────────────┬──────────────────┘  │
│          │ token                          │                      │
└──────────┼────────────────────────────────┼─────────────────────┘
           │                                │
    ┌──────▼──────┐                 ┌───────▼──────┐
    │ ACT Trader  │                 │  ACT Trader  │
    │ REST Auth   │                 │  WebSocket   │
    │ :10138      │                 │  :22138      │
    └─────────────┘                 └──────────────┘
           │
    ┌──────▼──────┐
    │  SQLite DB  │
    │  trades     │
    │  orders     │
    └─────────────┘
```

---

## Key Design Decisions

### 1. Authentication Flow
- Frontend POSTs credentials to `/auth/login`
- Backend calls ACT Trader REST endpoint, caches the token
- Token is auto-refreshed 60 seconds before expiry
- Backend issues its own internal JWT to the frontend — the ACT token never leaves the server

### 2. Real-Time Data Pipeline

```
ACT Trader WS → _ingest_loop() → _parse_message()
                                        ↓
                              _throttle_cache (per symbol)
                              Max 5 updates/sec per symbol
                                        ↓
                              asyncio.Queue per SSE client
                                        ↓
                              Browser EventSource (SSE)
                                        ↓
                              Zustand store → React re-render
```

**Why SSE over WebSocket for backend→frontend?**
SSE is simpler, works through HTTP/2, auto-reconnects natively in the browser, and is entirely sufficient for read-only price streaming. The upstream ACT Trader connection uses a full WebSocket.

### 3. Throttling Strategy
High-frequency tick data (potentially 50-100 Hz) is throttled to **5 Hz per symbol** before being pushed to UI clients. This prevents DOM thrashing while keeping the display visually responsive. The raw data is always fully processed internally.

### 4. Reconnection Logic
- Exponential backoff: 2s → 4s → 8s → … → 60s
- Token is re-acquired on each reconnect attempt
- All symbol subscriptions are re-sent after reconnect
- Frontend SSE also has its own reconnection loop with the same pattern

### 5. Order Execution Model
- `MARKET` orders: immediately filled at live bid/ask from the snapshot
- `LIMIT/STOP` orders: stored as `PENDING` (pending order matching is a known extension point)
- On fill: a `Trade` record is created and linked to the `Order` via `trade_id`

### 6. P&L Calculation
- **Unrealised P&L** (open trades): computed live in the browser using the latest bid/ask
- **Realised P&L** (closed trades): computed on the server at close time and stored in the DB

---

## Project Structure

```
trading-platform/
├── backend/
│   ├── main.py                          # FastAPI app, lifespan, CORS
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic settings (env vars)
│   │   │   └── security.py             # Internal JWT helpers
│   │   ├── db/
│   │   │   └── database.py             # Async SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── trade.py                # Trade ORM model
│   │   │   └── order.py                # Order ORM model
│   │   ├── services/
│   │   │   ├── act_auth_service.py     # ACT Trader token management
│   │   │   ├── market_data_service.py  # WS ingestion + throttle + fan-out
│   │   │   └── trade_service.py        # Order/trade business logic
│   │   └── api/
│   │       ├── router.py               # Aggregates all sub-routers
│   │       └── endpoints/
│   │           ├── auth.py             # POST /auth/login, /logout, /status
│   │           ├── market.py           # GET /market/snapshot, POST /subscribe
│   │           ├── orders.py           # CRUD orders
│   │           ├── trades.py           # List + close trades
│   │           └── stream.py           # GET /stream/prices (SSE)
│
└── frontend/
    └── src/
        ├── services/api.js             # Axios client + all API methods
        ├── store/store.js              # Zustand global state
        ├── hooks/useMarketStream.js    # SSE connection hook
        └── components/
            ├── LoginScreen.jsx         # ACT Trader credential form
            ├── Dashboard.jsx           # Main layout grid
            ├── TopBar.jsx              # Header: status, P&L, logout
            ├── Watchlist.jsx           # Symbol tiles with flash animation
            ├── PriceChart.jsx          # Live area chart (Recharts)
            ├── OrderTicket.jsx         # BUY/SELL form
            ├── PositionsTable.jsx      # Open/closed trades + close button
            ├── OrdersBlotter.jsx       # Order history + cancel
            └── Notifications.jsx      # Toast overlay
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Authenticate with ACT Trader credentials |
| POST | `/api/v1/auth/logout` | Invalidate token |
| GET | `/api/v1/auth/status` | Token + WS connection status |
| GET | `/api/v1/market/symbols` | Default watchlist symbols |
| GET | `/api/v1/market/snapshot` | Latest prices for all subscribed symbols |
| POST | `/api/v1/market/subscribe` | Subscribe to symbol `{"symbol": "EURUSD"}` |
| DELETE | `/api/v1/market/subscribe/{symbol}` | Unsubscribe from symbol |
| GET | `/api/v1/stream/prices` | **SSE stream** of throttled price updates |
| GET | `/api/v1/orders` | List recent orders |
| POST | `/api/v1/orders` | Place order `{symbol, side, order_type, quantity}` |
| DELETE | `/api/v1/orders/{id}` | Cancel a pending order |
| GET | `/api/v1/trades` | List all trades |
| GET | `/api/v1/trades/{id}` | Get single trade |
| POST | `/api/v1/trades/{id}/close` | Close open trade at market |
| GET | `/health` | Service health + WS status |

Full interactive docs: `http://localhost:8000/docs`

---

## Technology Choices

| Layer | Choice | Reason |
|-------|--------|--------|
| Backend language | Python 3.12 | Async-native, concise, excellent library support |
| Web framework | FastAPI | Async first, automatic OpenAPI docs, Pydantic validation |
| WebSocket client | `websockets` library | Async, production-grade |
| HTTP client | `httpx` | Async, clean API |
| Database ORM | SQLAlchemy (async) | Type-safe, async-native, supports SQLite → Postgres migration |
| Database | SQLite (aiosqlite) | Zero-config, sufficient for prototype |
| Frontend framework | React 18 + Vite | Fast HMR, modern ecosystem |
| State management | Zustand | Lightweight, no boilerplate, selector-based re-renders |
| Charting | Recharts | Composable React charts |
| API client | Axios | Interceptors for auth injection |

---

## Extension Points

- **Order matching engine**: Process pending LIMIT/STOP orders against live prices in a background task
- **Risk management**: Add position sizing limits, margin checks, drawdown alerts
- **Database**: Swap SQLite for PostgreSQL with no code changes (just change `DATABASE_URL`)
- **Auth**: Add per-user session isolation and multi-account support
- **Charting**: Add candlestick / OHLCV data if ACT Trader provides bar data
- **WebSocket push**: Replace SSE with a backend WebSocket for bidirectional control
