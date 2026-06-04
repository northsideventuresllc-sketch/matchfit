#!/usr/bin/env bash
# Copy matchfit-content-calendar.jsx from the Match Fit parent hub into the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/content/social/matchfit-content-calendar.jsx"

# Parent hub (sibling folder to match-fit-app on owner's machine)
HUB_DEFAULT="/Users/jonnybooth/Desktop/Desktop/Northside Ventures/Northside Intellegence/Sector 1-Non-Autonomous Agents/Sector 1A (Non Autonomous)/Match Fit/matchfit-content-calendar.jsx"
SRC="${MATCH_FIT_CONTENT_CALENDAR_SRC:-$HUB_DEFAULT}"

if [[ ! -f "$SRC" ]]; then
  echo "Source calendar not found: $SRC" >&2
  echo "Set MATCH_FIT_CONTENT_CALENDAR_SRC to your matchfit-content-calendar.jsx path." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Synced → $DEST"
