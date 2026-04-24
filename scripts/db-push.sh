#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB="$ROOT/apps/web"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env (Prisma needs DATABASE_URL)." >&2
  echo "Create it from the template:" >&2
  echo "  cp \"$ROOT/.env.example\" \"$ROOT/.env\"" >&2
  exit 1
fi

cd "$WEB"
exec dotenv -e "$ROOT/.env" -- prisma db push
