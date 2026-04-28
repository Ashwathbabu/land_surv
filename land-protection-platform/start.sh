#!/bin/bash
# Quick-start script for TerraWatch — runs backend and frontend in parallel.
# Requires: Python 3.10+, Node 18+, and an installed venv + node_modules.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting TerraWatch (Land Protection Platform)..."
echo ""
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo ""

# Start backend
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
  echo "!! Backend venv not found. Run: cd backend && python -m venv venv && pip install -r requirements.txt"
  exit 1
fi
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "!! Frontend node_modules not found. Run: cd frontend && npm install"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl-C to kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
