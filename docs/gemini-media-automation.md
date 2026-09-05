# Gemini media automation (headless, CDP-driven)

**Built:** 2026-08-13, JB direct order (live chat, escalated via Match Fit Repo Agent).
**Updated:** 2026-09-02 — wired to Content Calendar v2's real buttons, forced to Gemini
Pro, and corrected to match how this actually runs in production (see "What changed"
below — the original design doc described a path that was never implemented).
**Updated again 2026-09-03** (Decision #1722 item 4 + same-date Learning, lane D2): the
Gemini image API path this script's own doc already called dead was still wired into the
generate-media cron and the admin single-post action — both now route through
`queueMiniChromeAgentJob` instead, and this script now writes its result back onto the
`match_fit_content_cowork_jobs` row too (see "Job-queue write-back" below), which it
never did before.

**Why:** WF1 steps 3-9 (generate media in Gemini, crop, upload, write back) only ever
worked from an attended Cowork session with the desktop bridge. Every scheduled/cloud
session has zero bridge and zero OS-level screen/click access. This script replaces
that with a real, code-driven route — and it is the **only** route that actually
produces media: JB direct order 2026-09-03 (Decision #1722 item 4 + same-date Learning),
"media generation is NEVER the Gemini API — it is my Gemini subscription in Chrome on
the Mac mini." `src/lib/content-calendar/media-generation.ts` is now dead on purpose
(`generateStaticMedia` throws if called) — it used to call
`generativelanguage.googleapis.com` directly with a key that had **zero free-tier
image/video quota**, confirmed live 2026-08-04 (`nv-vault/scripts/media/README-mf-media-
drain.md`) and re-confirmed 2026-09-02/03. `.github/workflows/match-fit-content-
calendar-generate-media.yml` no longer runs on a GitHub Actions schedule at all
(Decision #1699), and the cron route it used to trigger
(`src/app/api/cron/content-calendar-generate-media/route.ts`) no longer calls that API
either — it only re-queues posts to this script via `queueMiniChromeAgentJob`.

## Architecture (as actually deployed)

```
Content Calendar v2 button (FIRE COWORK / SUBMIT FOR GENERATION / Send To Agent)
        │  fireCoworkForDay / fireCoworkForPost (content-calendar-cowork-orchestration.ts)
        │  → creates a match_fit_content_cowork_jobs row (job_type=generate_media) — the
        │    admin UI's job history, closed by this script itself when it finishes (see
        │    "Job-queue write-back" below) — not by anything that generates media
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
match_fit_content_cowork_jobs: any queued/dispatched/running generate_media job whose
brief references this post id is marked complete (or failed, on error) — see
"Job-queue write-back" below
        ▼
Telegram ping to JB when the batch finishes
```

## Job-queue write-back (added 2026-09-03, Decision #1722 item 4)

Before this, the script wrote the finished media onto the post row (`writeMediaResult`)
but never touched `match_fit_content_cowork_jobs` — so a job `fireMediaAgentForDay` /
`fireMediaAgentForPost` created stayed `queued`/`dispatched`/`running` forever from the
job-row's point of view, even after this script had actually finished the post. That let
the (now-corrected) REST cron keep treating the same post as unresolved and re-queue it,
racing with whatever the mini was doing.

`completeCoworkJobsForPost(postId, { generationSource })` now runs right after
`writeMediaResult` on success: it finds every `match_fit_content_cowork_jobs` row with
`job_type=generate_media` and `status in (queued, dispatched, running)` whose `brief`
JSON mentions this post id (matched client-side against the brief text — a job's brief
nests `postId` under a handful of different keys like `video`/`static`/`carousel`, not
one fixed column), and marks each `complete` with `result.generation_source` and
`completed_at`. `failCoworkJobsForPost(postId, message)` does the same thing on the
`catch` path, marking them `failed` with the real error instead. Either write failing is
logged as a `WARN`, never thrown — a job-queue write-back miss must never take down a
media generation run that otherwise succeeded.

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
- **Resolved (Carousel slide splitting).** Confirmed by SQL against a
  real Carousel post that Match Fit Carousels are genuinely 5 separate PNG
  generations, not one multi-panel composite — `content-prompts.ts`'s
  `CONTENT_CALENDAR_CREATIVE_QUALITY_RULES` (JB-locked) and
  `content-calendar-v2-store.ts`'s instant-preview path both already treat a
  Carousel as N discrete images. The content calendar never emits a literal
  `---SLIDE---` marker — it labels slides in natural language ("Slide 1 (Image
  1):", "Slide 2:", ... "Slide 5 CTA card:"). The script's splitter
  (`scripts/carousel-slide-prompts.mjs`, `splitCarouselSlidePrompts()`) now
  parses that real label format — carrying the shared header (dimensions/
  format/branding/rules) and the shared "PRODUCTION SPEC (required):" footer
  into every slide's prompt — and keeps `---SLIDE---` as a fallback for
  hand-authored prompts that still use it. See
  `scripts/carousel-slide-prompts.test.mjs` for coverage.
