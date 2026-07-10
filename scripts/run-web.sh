#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
ROOT="/Users/kashika/dev/RAG"
cd "$ROOT/apps/web"
exec ./node_modules/.bin/next dev -H 127.0.0.1 -p 3000
