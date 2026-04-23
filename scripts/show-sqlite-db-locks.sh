#!/usr/bin/env bash
# Lists processes holding prisma/dev.db (common cause of SQLITE_BUSY during local dev).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/prisma/dev.db"
if [[ ! -f "$DB" ]]; then
  echo "No database file at $DB"
  exit 0
fi
echo "File: $DB"
echo ""
echo "Holders (lsof):"
if command -v lsof >/dev/null 2>&1; then
  lsof "$DB" 2>/dev/null || echo "  (none reported)"
else
  echo "  lsof not found; on macOS it is usually pre-installed."
fi
echo ""
echo "Typical fixes:"
echo "  - Stop other terminals running: npm run dev"
echo "  - Quit Prisma Studio if it is open on this database"
echo "  - Stop parallel test runs: npm test"
echo "  - Then: pkill -f 'next dev'   # only if you know no other Next apps need it"
