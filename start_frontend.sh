#!/usr/bin/env bash
# start_frontend.sh – Start the TradingPlatform React dev server
set -e
cd "$(dirname "$0")/frontend"

echo "Installing Node dependencies..."
npm install --silent

echo ""
echo "Starting TradingPlatform frontend on http://localhost:5173"
echo ""

npm run dev
