#!/usr/bin/env bash
# Install + start DocMind as macOS LaunchAgents (auto-restart if they crash).
set -euo pipefail
ROOT="/Users/kashika/dev/RAG"
UID_NUM="$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"

chmod +x "$ROOT/scripts/run-web.sh" "$ROOT/scripts/run-worker.sh" "$ROOT/scripts/"*.sh
mkdir -p "$AGENTS" "$ROOT/uploads"

cd "$ROOT"
docker compose up -d

# Stop old one-off processes
lsof -iTCP:3000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9 2>/dev/null || true
pkill -f 'tsx src/index.ts' 2>/dev/null || true
pkill -f 'scripts/start-local.sh' 2>/dev/null || true
sleep 1

cp "$ROOT/scripts/com.docmind.web.plist" "$AGENTS/"
cp "$ROOT/scripts/com.docmind.worker.plist" "$AGENTS/"

launchctl bootout "gui/$UID_NUM/com.docmind.web" 2>/dev/null || true
launchctl bootout "gui/$UID_NUM/com.docmind.worker" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$AGENTS/com.docmind.web.plist"
launchctl bootstrap "gui/$UID_NUM" "$AGENTS/com.docmind.worker.plist"
launchctl enable "gui/$UID_NUM/com.docmind.web"
launchctl enable "gui/$UID_NUM/com.docmind.worker"
launchctl kickstart -k "gui/$UID_NUM/com.docmind.web"
launchctl kickstart -k "gui/$UID_NUM/com.docmind.worker"

echo "Waiting for http://127.0.0.1:3000 …"
for i in $(seq 1 45); do
  if curl -sf --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "OK — site is up (LaunchAgents will auto-restart if it crashes)"
    open "http://127.0.0.1:3000/dashboard"
    exit 0
  fi
  sleep 1
done
echo "Failed to come up. Check:"
echo "  tail -50 /tmp/rag-web.log /tmp/rag-web.err.log"
exit 1
