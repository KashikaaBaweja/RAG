#!/usr/bin/env bash
# Start DocMind locally and keep web + worker alive.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_LOG="${TMPDIR:-/tmp}/rag-web.log"
WORKER_LOG="${TMPDIR:-/tmp}/rag-worker.log"
PID_DIR="${TMPDIR:-/tmp}/rag-pids"
UPLOAD_DIR="${RAG_UPLOAD_DIR:-$ROOT/uploads}"

mkdir -p "$PID_DIR" "$UPLOAD_DIR"

echo "==> Root: $ROOT"
echo "==> Uploads: $UPLOAD_DIR"

cd "$ROOT"
docker compose up -d

# Ollama is optional when using Gemini; start if installed
if command -v ollama >/dev/null 2>&1; then
  if ! curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    nohup ollama serve >"${TMPDIR:-/tmp}/ollama-rag.log" 2>&1 &
    echo $! >"$PID_DIR/ollama.pid"
    echo "==> Started ollama"
  fi
fi

start_web() {
  if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "==> Web already on :3000"
    return
  fi
  cd "$ROOT/apps/web"
  nohup ./node_modules/.bin/next dev -H 127.0.0.1 -p 3000 >"$WEB_LOG" 2>&1 &
  echo $! >"$PID_DIR/web.pid"
  echo "==> Started web (pid $(cat "$PID_DIR/web.pid")) log: $WEB_LOG"
}

start_worker() {
  if pgrep -f "apps/worker.*tsx src/index.ts" >/dev/null 2>&1 || pgrep -f "tsx src/index.ts" >/dev/null 2>&1; then
    # only skip if our worker pid file is alive
    if [[ -f "$PID_DIR/worker.pid" ]] && kill -0 "$(cat "$PID_DIR/worker.pid")" 2>/dev/null; then
      echo "==> Worker already running"
      return
    fi
  fi
  cd "$ROOT/apps/worker"
  RAG_UPLOAD_DIR="$UPLOAD_DIR" nohup ./node_modules/.bin/tsx src/index.ts >"$WORKER_LOG" 2>&1 &
  echo $! >"$PID_DIR/worker.pid"
  echo "==> Started worker (pid $(cat "$PID_DIR/worker.pid")) log: $WORKER_LOG"
}

start_web
start_worker

# Wait until web responds
for i in $(seq 1 30); do
  if curl -sf --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "==> Web is up: http://127.0.0.1:3000"
    break
  fi
  sleep 1
done

# Watchdog: restart if web/worker die
echo "==> Watchdog running (Ctrl+C to stop). Keeping site alive…"
while true; do
  if ! curl -sf --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "$(date '+%H:%M:%S') web down — restarting"
    # free port if a zombie holds it
    lsof -iTCP:3000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9 2>/dev/null || true
    sleep 1
    start_web
  fi
  if [[ -f "$PID_DIR/worker.pid" ]] && ! kill -0 "$(cat "$PID_DIR/worker.pid")" 2>/dev/null; then
    echo "$(date '+%H:%M:%S') worker down — restarting"
    start_worker
  fi
  sleep 5
done
