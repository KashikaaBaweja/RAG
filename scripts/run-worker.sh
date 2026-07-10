#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
ROOT="/Users/kashika/dev/RAG"
export RAG_UPLOAD_DIR="${RAG_UPLOAD_DIR:-$ROOT/uploads}"
# Load env for Gemini / Redis / etc.
set -a
[[ -f "$ROOT/.env" ]] && . "$ROOT/.env"
[[ -f "$ROOT/apps/web/.env.local" ]] && . "$ROOT/apps/web/.env.local"
set +a
cd "$ROOT/apps/worker"
exec ./node_modules/.bin/tsx src/index.ts
