# Gemini media automation (headless, CDP-driven)

**Built:** 2026-08-13, JB direct order (live chat, escalated via Match Fit Repo Agent).
**Updated:** 2026-09-02 — wired to Content Calendar v2's real buttons, forced to Gemini
Pro, and corrected to match how this actually runs in production (see "What changed"
below — the original design doc described a path that was never implemented).

**Why:** WF1 steps 3-9 (generate media in Gemini, crop, upload, write back) only ever
worked from an attended Cowork session with the desktop bridge. Every scheduled/cloud
session has zero bridge and zero OS-level screen/click access. This script replaces
that with a real, code-driven route — and it is the **only** route that actually
produces media: the Gemini Developer API key behind the REST cron
(`src/lib/content-calendar/media-generation.ts`, drained by
`.github/workflows/match-fit-content-calendar-generate-media.yml`) has **zero free-tier
image/video quota** on the Google Cloud project it's tied to — confirmed live 2026-08-04
(`nv-vault/scripts/media/README-mf-media-drain.md`) and re-confirmed live 2026-09-02.
That path cannot succeed regardless of model name or retry count; do not spend more time
tuning it.

## Architecture (as actually deployed)

```
Content Calendar v2 button (FIRE COWORK / SUBMIT FOR GENERATION / Send To Agent)
        │  fireCoworkForDay / fireCoworkForPost (content-calendar-cowork-orchestration.ts)
        │  → creates a match_fit_content_cowork_jobs row (job_type=generate_media) — kept
        │    for the admin UI's own job history, but nothing drains it into real media
        │  → queueMiniChromeAgentJob (cowork-jobs.ts) inserts nvg_mini_jobs
        │    (kind="shell", cmd="cd $HOME/nvg-gemini-automation && node
        │    gemini-media-automation.mjs --ids=<postId,...>")
        ▼
mini's own job-queue runner (liveness: nvg_mini_heartbeat), polling nvg_mini_jobs
        │  runs the shell command directly — kind="shell" is the ONLY kind the runner
        │  executes; there is no dedicated "gemini_generate" kind (see below)
        ▼
$HOME/nvg-gemini-automation/gemini-media-automation.mjs, on the mini
        │  connects to a dedicated automation Chrome profile over CDP (does not touch
        │  JB's live logged-in Chrome — separate --user-data-dir + port, launched by
        │  scripts/mini-chrome-automation-launcher.sh)
        │  confirms/sets the Gemini web app's mode picker to Pro (JB order 2026-09-01/02
        │  — Flash is never acceptable); pastes last_generation_prompt (or visual_prompt
        │  as fallback), generates, uses Gemini's "Copy image" control + clipboard read
        │  (the Download button opens a native save dialog Playwright/CDP can't drive)
        ▼
sharp .trim() crops the white frame Gemini stamps on every output
        ▼
Supabase Storage bucket content-calendar-media (NI-Brain project kxijunwgbrlfzvgkhklo)
        ▼
match_fit_content_calendar_posts: media_url/media_urls/media_status='ready' AND
workflow_stage/status → "publishing" (matches completeGenerateMediaJob's write-back
exactly, guarded on workflow_stage still being "pending" so a post JB already moved
elsewhere is left alone)
        ▼
Telegram ping to JB when the batch finishes
```

## What changed 2026-09-02 (read this before trusting the rest of this doc)

The original design below assumed a dedicated `nvg_mini_jobs` job kind (`gemini_generate`)
that `nvg-mini-runner.py` would handle natively, deploying the script to
`/usr/local/lib/nvg-gemini/`. **That kind was documented but never implemented** — every
real, successful run instead used a plain `kind="shell"` row running
`node gemini-media-automation.mjs --ids=...` from `$HOME/nvg-gemini-automation` (the
mini's actual deployed path). `queueMiniChromeAgentJob` now queues exactly that —
matching what's proven to work, not the never-built design.

The deployed copy of the script on the mini had also drifted from git through several
rounds of live debugging (2026-08-27/28) — a real regex bug fix and a switch from the
Download-button approach to the "Copy image" + clipboard-read approach (the Download
button opens a native OS save dialog that Playwright/CDP cannot see or drive). Those
fixes are now folded back into `scripts/gemini-media-automation.mjs` in git, so git is
the source of truth again. If you touch this script, deploy your change to
`$HOME/nvg-gemini-automation/gemini-media-automation.mjs` on the mini (e.g. `curl` the
raw file from GitHub `main` once your PR is merged) — do not let it drift again.

Also new: `fetchRows` now selects `last_generation_prompt` and `workflow_stage`, and
Content Calendar v2's generation gate is `status="pending"` (not `status="approved"`,
which is v1's older contract) — the script now trusts the caller's own gate when
explicit `--ids` are given, and only enforces `status="approved"` for the older
date-batch invocation (`--post-date`/`--post-group`, unused by v2).

## Files

- `scripts/gemini-media-automation.mjs` — the automation itself.
- `scripts/mini-chrome-automation-launcher.sh` — launches/confirms the dedicated
  Chrome profile + CDP port. Idempotent — safe to call every job.

## One-time bootstrap on the mini (confirmed live 2026-09-02)

1. `$HOME/nvg-gemini-automation/` already exists on the mini with `playwright-core` and
   `sharp` installed — deploy new script versions there (see "What changed" above).
2. `/usr/local/etc/nvg-mini.env` already carries `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`.
   `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_IDS` were not set as of 2026-09-02 — Telegram
   pings are silently skipped (logged, not fatal) until JB adds them.
3. `scripts/mini-chrome-automation-launcher.sh` seeds the automation profile from a copy
   of the Default profile's session on first run — confirmed live 2026-09-02, real
   Google session, no manual login needed that time. If a future seed comes up stale,
   JB has to log into Gemini once, by hand, on the automation profile — nothing here can
   do that for him.
4. `node gemini-media-automation.mjs --check` — must print `CHECK_OK: ... mode is Pro.`
   Confirms CDP reachable, Gemini session logged in, AND the mode picker is on Pro (not
   whatever it was last left on — confirmed live 2026-09-02 it can default to
   Flash-Lite).

## Known limits

- Selectors for Gemini's generate/mode-picker/copy-image UI are confirmed against a
  live, logged-in session as of 2026-09-02 — but Gemini's DOM can drift. If a run starts
  failing with `NEW_IMAGE_NEVER_APPEARED`, `COPY_BUTTON_NOT_FOUND`,
  `PRO_MODE_OPTION_NOT_FOUND`, or `PRO_MODE_NOT_CONFIRMED`, that's the first thing to
  check — re-probe the live DOM rather than guessing at a fix.
- The CDP endpoint has been observed going unresponsive after ~2 days of continuous
  Chrome uptime (needs the launcher re-run to relaunch it) — not yet root-caused.
- Carousel rows: the script splits the prompt on a `---SLIDE---` marker to support
  multi-image carousels in one job. Confirm the content-generation step actually writes
  that marker for Carousel posts before relying on multi-slide output.
