#!/usr/bin/env bash
# start_backend.sh – Start the TradingPlatform FastAPI backend
set -e
cd "$(dirname "$0")/backend"

echo "Installing Python dependencies..."
pip install fastapi uvicorn websockets httpx sqlalchemy aiosqlite \
    python-jose python-multipart pydantic-settings --quiet

echo ""
echo "Starting TradingPlatform backend on http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info
