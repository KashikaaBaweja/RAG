#!/usr/bin/env bash
# One-shot start (no watchdog). Opens the dashboard.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPLOAD_DIR="${RAG_UPLOAD_DIR:-$ROOT/uploads}"
mkdir -p "$UPLOAD_DIR"
cd "$ROOT"
docker compose up -d
lsof -iTCP:3000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9 2>/dev/null || true
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
cd "$ROOT/apps/web"
nohup ./node_modules/.bin/next dev -H 127.0.0.1 -p 3000 >/tmp/rag-web.log 2>&1 &
cd "$ROOT/apps/worker"
RAG_UPLOAD_DIR="$UPLOAD_DIR" nohup ./node_modules/.bin/tsx src/index.ts >/tmp/rag-worker.log 2>&1 &
for i in $(seq 1 40); do
  if curl -sf --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    open "http://127.0.0.1:3000/dashboard"
    echo "Opened http://127.0.0.1:3000/dashboard"
    exit 0
  fi
  sleep 1
done
echo "Web did not become ready. Check /tmp/rag-web.log"
exit 1
