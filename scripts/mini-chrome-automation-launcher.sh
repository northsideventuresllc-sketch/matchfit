#!/bin/zsh
# MINI CHROME AUTOMATION LAUNCHER (JB direct order, 2026-08-13)
# -----------------------------------------------------------------------------
# Launches (or confirms) a DEDICATED Chrome profile on the Mac mini with
# --remote-debugging-port open, so gemini-media-automation.mjs can drive it
# over CDP/Playwright. Never touches JB's live, logged-in default Chrome —
# this is a separate --user-data-dir and a separate port.
#
# First run bootstraps the automation profile by COPYING the Default
# profile's session/cookie state (same OS user, same macOS Keychain-backed
# cookie encryption key, so a copied Google session decrypts and validates
# fine on the same machine). This is a one-time seed, not a live share — the
# two profiles diverge after this and Default is never touched again.
#
# If Google still shows a sign-in page after the copy (session expired /
# 2FA re-challenge), that is a genuine blocker: JB has to log into Gemini
# once on the automation profile by hand. Nothing here can complete a login
# on his behalf.
#
# Usage: mini-chrome-automation-launcher.sh [port] [profile-dir]

set -e

PORT="${1:-9333}"
PROFILE_DIR="${2:-$HOME/.nvg-chrome-automation}"
DEFAULT_PROFILE="$HOME/Library/Application Support/Google/Chrome"
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "== nvg gemini automation chrome launcher =="
echo "port=$PORT profile_dir=$PROFILE_DIR"

# Already running against this exact profile+port? Don't relaunch.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  RUNNING_PROFILE=$(ps aux | grep "remote-debugging-port=$PORT" | grep -v grep | grep -o "user-data-dir=[^ ]*" | head -1)
  if [ -n "$RUNNING_PROFILE" ]; then
    echo "ALREADY_RUNNING: $RUNNING_PROFILE on port $PORT"
    exit 0
  fi
fi

# Bootstrap the automation profile the first time only.
if [ ! -d "$PROFILE_DIR/Default" ]; then
  echo "First run — seeding automation profile from Default session..."
  mkdir -p "$PROFILE_DIR"
  # Copy just what carries the logged-in session: cookies, local storage,
  # login data, session storage. NOT extensions/history/bookmarks — keeps
  # this a clean automation profile, not a mirror of JB's daily browsing.
  for item in "Default/Cookies" "Default/Local Storage" "Default/Session Storage" \
              "Default/Login Data" "Default/Network" "Local State"; do
    SRC="$DEFAULT_PROFILE/$item"
    DEST="$PROFILE_DIR/$item"
    if [ -e "$SRC" ]; then
      mkdir -p "$(dirname "$DEST")"
      cp -R "$SRC" "$DEST" 2>/dev/null || echo "  (skip $item — locked or missing, non-fatal)"
    fi
  done
  mkdir -p "$PROFILE_DIR/Default"
  echo "Seed copy done."
else
  echo "Automation profile already exists at $PROFILE_DIR — not re-seeding."
fi

echo "Launching Chrome (automation profile, debug port $PORT)..."
"$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=Translate \
  "https://gemini.google.com/app" \
  >/tmp/nvg-gemini-chrome.log 2>&1 &

disown
sleep 3

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "LAUNCHED_OK: CDP listening on $PORT"
  exit 0
else
  echo "LAUNCH_FAILED: nothing listening on $PORT after launch — see /tmp/nvg-gemini-chrome.log"
  exit 1
fi
