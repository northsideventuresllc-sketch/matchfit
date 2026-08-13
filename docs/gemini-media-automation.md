# Gemini media automation (headless, CDP-driven)

**Built:** 2026-08-13, JB direct order (live chat, escalated via Match Fit Repo Agent).
**Why:** WF1 steps 3-9 (generate media in Gemini, crop, upload, write back) only ever
worked from an attended Cowork session with the desktop bridge. Every scheduled/cloud
session has zero bridge and zero OS-level screen/click access — confirmed live
2026-08-13 (`nvg_mini_jobs` kind=screen only drives an Android emulator that doesn't
exist here; `osascript` GUI scripting has no Accessibility permission granted to the
headless runner process). This replaces both with a real, code-driven route.

## Architecture

```
cloud/scheduled session
        │  insert nvg_mini_jobs (kind='gemini_generate', payload={...})
        ▼
nvg-mini-runner.py (Mac mini, local file, LaunchAgent)
        │  runs: /usr/local/bin/mini-chrome-automation-launcher.sh (idempotent)
        │  runs: node /usr/local/lib/nvg-gemini/gemini-media-automation.mjs
        ▼
dedicated Chrome profile (~/.nvg-chrome-automation), --remote-debugging-port=9333
        │  Playwright connects over CDP — NOT JB's live logged-in Chrome
        ▼
Gemini (gemini.google.com/app) → generate → download → sharp .trim() crop
        ▼
Supabase Storage bucket content-calendar-media (kxijunwgbrlfzvgkhklo)
        ▼
match_fit_content_calendar_posts.media_urls + media_status='ready'
        │  (never touches `status` — posting approval stays JB-gated)
        ▼
Telegram ping to JB when the batch finishes
```

## Files

- `scripts/gemini-media-automation.mjs` — the automation itself. Canonical source
  lives here in git; a synced copy runs from `/usr/local/lib/nvg-gemini/` on the mini
  (that machine has no matchfit checkout, so the runner shells out to a plain copy,
  not a git working tree).
- `scripts/mini-chrome-automation-launcher.sh` — launches/confirms the dedicated
  Chrome profile + CDP port. Idempotent — safe to call every job.

## One-time bootstrap needed on the mini (not yet proven end-to-end)

1. `mkdir -p /usr/local/lib/nvg-gemini && cd /usr/local/lib/nvg-gemini`
2. `npm init -y && npm install playwright-core sharp`
3. Deploy `gemini-media-automation.mjs` into that dir (kept in sync with git via
   the mini-relay push + a copy step — see `nvg-mini-runner.py` kind=`gemini_generate`).
4. Deploy `mini-chrome-automation-launcher.sh` to `/usr/local/bin/`, `chmod +x`.
5. Add to `/usr/local/etc/nvg-mini.env` (chmod 600, already has `SUPABASE_URL` /
   `SUPABASE_SERVICE_KEY`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS` (comma-sep),
   `GEMINI_CDP_PORT` (default 9333 if omitted).
6. Run the launcher once. It seeds the automation profile from a copy of the
   Default profile's `Cookies` / `Local Storage` / `Session Storage` / `Login Data`
   (same OS user + same macOS Keychain-backed cookie encryption key, so a copied
   Google session decrypts fine on the same machine — this is a one-time seed, not
   a live share; the profiles diverge immediately after).
7. Run `node gemini-media-automation.mjs --check` — must print `CHECK_OK`. If it
   prints `NOT_LOGGED_IN`, the copied session was stale/expired and **JB has to log
   into Gemini once, by hand, on the automation profile** — nothing here can do
   that for him. That is a real, load-bearing manual step, not a workaround to
   route around.

## nvg_mini_jobs wiring

New job kind `gemini_generate`. Payload:

```json
{ "job_payload": { "ids": ["<uuid>", "..."] }, "timeout": 900 }
```
or
```json
{ "job_payload": { "post_date": "2026-08-13", "post_group": "5pm" }, "timeout": 900 }
```

The runner launches the Chrome profile (no-op if already up), writes `job_payload`
to a temp file, and runs `node gemini-media-automation.mjs --payload=<tmp>`.

## Known limits / not yet proven

- Selectors for Gemini's generate/download UI (`generateAndDownload()` in the
  script) are written against the documented Gemini web UI patterns but **have
  not been exercised against a live, logged-in session in this build session** —
  the mini has no browser/screen access from a cloud session to visually verify
  DOM selectors, and the login bootstrap step above was not completed live here.
  First real run should be watched (or its Telegram/DB result checked closely) and
  selectors patched if Gemini's DOM has drifted.
- Carousel rows: the script splits `visual_prompt` on a `---SLIDE---` marker to
  support multi-image carousels in one job. If the content calendar doesn't
  actually write that marker, carousels will currently generate a single image —
  flag to JB / the content-generation step if that's the real format.
