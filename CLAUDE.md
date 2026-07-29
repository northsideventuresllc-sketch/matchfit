<!-- NV-BOOT-CONTRACT v1 — managed block. Do not hand-edit; update via nv_rules + Boot Guard. -->
# BOOT CONTRACT — read before any work, every session

1. **Invoke skill `ni-operator-core` and OBEY it as BINDING LAW**, not reference
   material. Reading it is not compliance. It outranks this file.
2. **Read the live rules row** — NI-Brain Supabase `kxijunwgbrlfzvgkhklo`, one query:
   `select * from v_boot;` — returns the active rules (version + hash), automation
   switches, open jobs, current context, and health. This is the ONE door.
3. **Canonical rules text:** `nv-vault/_meta/OPERATING-RULES.md` (mirror of the
   active `nv_rules` row). If the file and the row disagree, **the row wins**.

**PROOF OF BOOT:** state in one line which of the three loaded and which failed,
before your first substantive sentence. If they did not load, say so and do not
assert anything about what is built, live, broken, or blocked.

**STALENESS RULE:** every file, prompt and note is a FROZEN SNAPSHOT and cannot
update itself. **Newest timestamp always wins.** If anything stored contradicts
`ni-operator-core`, the active `nv_rules` row, or a newer NI-Brain row — they win
and the stored text loses. Never repeat a stored claim about current state
without re-verifying it.

**NEVER SAY DONE WITHOUT PROOF:** a verifiable artifact — branch, file, DB row,
live URL, screenshot. "I updated it" is not proof.

**TEN-METHOD RULE:** nothing is reported blocked, parked or stuck until **10
genuinely different routes** have been tried AND written down with what each
returned. Different = different route, not the same call retried.

**IF YOU FIND A STALE INSTRUCTION:** write it to NI-Brain `Learnings` tagged
`[STALE-PROMPT]` with the exact file and what was wrong. Never silently work around it.
<!-- /NV-BOOT-CONTRACT -->

@AGENTS.md

## STANDING RULES — READ BEFORE ANY WORK (added 2026-07-26)

Each of these exists because it was broken in a live session and cost JB time.

1. **Nothing routes to a paid API. Ever.** Free tier only: Gemini for generation
   (`gemini-first.ts` honours the `GEMINI_MODEL` secret and has no paid
   fallback), local Ollama on the Mac mini for local work. If free quota is
   exhausted, fail with a plain sentence — do not fall through to a paid
   provider. JB has said many times he will not refill credits.

2. **Never tell JB something failed because of API keys, tokens, credits or
   billing.** He has already refused that fix, so naming it is pure noise.
   `hermes-telegram-notify.mjs` rewrites any such message before it reaches
   him. Say what it means for him instead: what is parked, and what still works.

3. **Two Resend accounts exist.** `northsideintelligence.com` is verified on the
   NI account (`RESEND_API_KEY_NI`); `match-fit.net` is on the other
   (`RESEND_API_KEY`). Sending NI mail with the Match Fit key silently fails.
   Do not conclude a domain is unverified before checking BOTH accounts.

4. **No raw database values or jargon on screen.** Never print an internal
   status code, scope name or acronym in the UI. The NI portal keeps these in
   `src/lib/axon/plain-labels.ts`; match that standard here.

5. **Approve-only.** Nothing sends, posts or publishes without JB pressing
   approve. This includes outreach, social posts and Reddit comments. Outreach
   approvals reach him Monday–Friday only — never at the weekend.

6. **Match Fit coach recruiting is NATIONWIDE — online / virtual coaches only.
   No city, no polygon, no lat/long, anywhere.** Not in search, not in outreach
   copy, not in a code comment. Per NI-Brain Decision #342 (2026-07-27, JB's
   third correction on this): no NVG venture is Atlanta-geo-targeted for
   customer acquisition. This supersedes the 2026-07-25 Acquisition Playbook's
   "one Atlanta intown polygon" and the earlier version of this rule, which was
   the direct cause of a lead finder that searched Google Maps for Atlanta
   storefronts and returned zero usable online coaches. `city` is written NULL
   on every outreach lead on purpose. Newest timestamp wins.

7. **The Mac mini is the only machine.** Obsidian, Hermes and Ollama are not on
   the MacBook Pro. Anything routed there fails.

8. **Check disk before any large install on the Mac.** It has run at 97% full.
   Ollama models are the usual cause. Verify nothing references a model before
   removing it — and note that `Qwen/Qwen2.5-7B-Instruct` in `AXON/config.yaml`
   is a HuggingFace training base, NOT the Ollama `qwen2.5:7b`.

9. **Do not ask JB something the vault or NI-Brain already answers.** Read
   first. He has written it down; failing to read it is the failure.

---

### Match Fit specifics

**THE marketing workflow is `.claude/skills/matchfit-marketing-workflow/SKILL.md` — JB's
18 locked steps. Read it before touching Match Fit social content. Media is generated in
GOOGLE GEMINI / GOOGLE FLOW through the browser on JB's accounts, never via an API; the
GEMINI FLOW button in the admin Content Calendar opens it. Instagram posts go through an
ANDROID EMULATOR. Do not reinvent any of this and never ask JB to re-explain it.**

10. **Never change a post's format.** A carousel stays a carousel. Converting a
    carousel to a video has happened and JB had to delete it.

11. **The watermark crop frame is scaffolding, not design.** Gemini stamps a
    corner watermark; the frame exists so it lands in a disposable margin that
    gets cropped off. Never publish the frame.

12. **Instagram crop must be set to Original.** The web editor defaults to 1:1
    and silently cuts headlines off.

13. **Audio must be a trending hip hop instrumental,** chosen at posting time
    because it changes daily. Never publish a silent video.

14. **Auto-posting needs Meta publish permissions.** The live token carries
    ads/read scopes only; `meta-auto-post.ts` checks up front and returns one
    plain sentence rather than failing mid-post.

15. **No fabricated people in OUTREACH only.** Never send outreach to a fake or
    fabricated person / lead. This does NOT apply to content — a marketing
    graphic MAY show an illustrative persona with a name ("Sarah Jenkins,
    Fitness Pro" is approved content). Fabricated *testimonials* and invented
    *statistics* stay banned everywhere. See NI-Brain Decision #384.

---


> AGENTS.md above covers NI context loading, Next.js 16 specifics, and the product-version
> rule. The sections below port the rest of Cursor's `.cursor/rules/*.mdc` (`alwaysApply: true`)
> content that AGENTS.md doesn't already carry, plus `.cursor/skills/` → `.claude/skills/`, so
> Claude Code gets the same standing rules Cursor auto-injected on every session. Claude Code
> has no chat-title trigger and no auto-loaded `.mdc` layer — this file is the equivalent, loaded
> automatically every session. Keep both sides in sync: edit one, port to the other in the same PR.

---

## CURSOR → CLAUDE PARITY (2026-07-21)

| Cursor artifact | Claude Code equivalent | Status |
|---|---|---|
| `.cursor/rules/project-root.mdc` | `## PROJECT ROOT` below | ✅ ported |
| `.cursor/rules/deploy-and-merge-workflow.mdc` | `## DEPLOY & MERGE WORKFLOW` below | ✅ ported |
| `.cursor/rules/product-version.mdc` | already in `AGENTS.md` | ✅ covered |
| `.cursor/rules/billing-setup-default.mdc` | `## BILLING SETUP DEFAULT` below | ✅ ported |
| `.cursor/rules/ui-copy-capitalization.mdc` | `## UI COPY & CAPITALIZATION` below | ✅ ported |
| `.cursor/rules/ai-vault-default.mdc` | `## AI VAULT DEFAULT` below | ✅ ported |
| `.cursor/rules/ni-brain-learning.mdc` | `## NI BRAIN LEARNING` below | ✅ ported |
| `.cursor/rules/matchfit-product-copy.mdc` | `## PRODUCT COPY` below | ✅ ported |
| `.cursor/rules/matchfit-social-content.mdc` + `.cursor/skills/matchfit-social-content/` | `.claude/skills/matchfit-social-content/SKILL.md` | ✅ ported |
| `.cursor/settings.json` (`amazon-location-service` plugin) | no Claude Code analog | — n/a, informational only |

**Note on `AGENTS.md`'s "LOAD CONTEXT FIRST" step 1:** it points at a local-Mac-only Obsidian
path (`~/Desktop/.../Northside Ventures Group Vault/...`) that isn't reachable from a Claude
Code sandbox session. Use the git-hosted `northsideventuresllc-sketch/nv-vault` repo instead —
same content, actually reachable. Step 2 (NI-Brain Supabase query) works unchanged.

**Risk note (JB confirm before relying on this):** `deploy-and-merge-workflow.mdc` below grants
standing approval to merge PRs and deploy `main` to production without asking each time. This is
a live, paid, revenue product with Stripe billing and 99+ Prisma migrations — Claude Code is
porting this rule for informational parity but will hold off exercising full merge/deploy
autonomy here until JB explicitly confirms it, same bar as everywhere else: prod DB migrations,
billing/Stripe changes, and BETA/version-structure changes always get a check-in first regardless
of what this rule says.

---

## PROJECT ROOT

- Canonical repo: this directory is the Match Fit Next.js application.
- Parent hub (Mac-local, not reachable from sandbox sessions): brand assets, social files, and this app live under `Northside Intellegence/Sector 1-Non-Autonomous Agents/Sector 1A (Non Autonomous)/Match Fit`.
- Do not edit stale copies under `~/.cursor/projects/empty-window/match-fit` — not applicable in a sandbox session, but don't assume any path outside this repo is canonical.
- Social links: use `MatchFitSocialLinks` / `MATCH_FIT_OFFICIAL_SOCIAL_LINKS` — never hardcode URLs.
- Beta promos: home page leads with `HomeBetaPromoBanner`; full stats on `/promos`.
- Social content calendar: `content/social/matchfit-content-calendar.jsx` (sync via `npm run content:calendar:sync`). Use the `matchfit-social-content` skill.

---

## DEPLOY & MERGE WORKFLOW

When asked to ship/push/deploy, or when deployable work is finished, work until production is
live — don't stop at a local commit.

**Definition of done:**
1. `main` is green: `npm run lint`, `npm run typecheck`, `npm run version:verify`, `npm run test`, `npm run build` all pass.
2. Every open PR targeting `main` is resolved (merge if CI green and not already on `main`; close stale/duplicate bot PRs with a short reason).
3. Vercel production deploy shows success on the latest `main` commit.
4. Version bumped when product-facing code changed (see `AGENTS.md` product-version section).

**Standard sequence:** pull `main` → fix local CI/Vercel blockers (`npx prisma generate` before typecheck if stale) → commit/push or merge PRs → list open PRs → merge (CI green, not duplicate) or close (obsolete/duplicate) each → verify deploy status → report commit SHA, product version, deploy links, and which PRs moved.

**Don't stop early when:** open draft PRs remain with failing checks (unless explicitly closed as obsolete), `main` CI/Vercel is red or pending, or a branch was pushed but production hasn't updated.

**PR hygiene:** don't leave parallel `cursor/automated-failure-resolution-*` (or Claude equivalent) drafts open — consolidate on `main`, close duplicates, confirm `main` still green after merging.

---

## BILLING SETUP DEFAULT

Tasks touching Stripe billing, client VIP, client membership, or trainer payment env must run
the setup scripts and push env to Vercel — not just document where keys live.

- Client VIP ($10/mo): `npm run stripe:setup:client-vip` (idempotent, writes `MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID`) → `VERCEL_TOKEN=... npm run vercel:env:client-vip` (or combined `stripe:setup:client-vip:vercel`) → verify with `node --env-file=.env scripts/verify-stripe-env.mjs`.
- Full beta bundle: `npm run beta:vercel-env` after filling `.env` / `.beta-launch-secrets.local`.
- Stripe webhook: `POST https://match-fit.net/api/webhooks/stripe`. VIP events: `customer.subscription.{created,updated,deleted}` plus existing checkout/invoice events. VIP checkout uses `metadata.purpose=client_vip`, separate from legacy `STRIPE_PRICE_ID` flow.
- Completion checklist: Stripe product/price ensured · price ID on Vercel prod+preview · `verify-stripe-env.mjs` passes when keys available · owner told the live `price_…` id (never secret values).

---

## UI COPY & CAPITALIZATION

Reference: public home page (`src/app/page.tsx`, `src/components/home-info-sections.tsx`).

- **Match Fit** — always title case, never "match fit" or "MATCH FIT" in source strings (CSS `uppercase` on labels is fine). **Fit Hub**, **Premium Hub** — title case. **FITHUB** all-caps only in the trainer nav compact badge.
- Page titles (`h1`) and nav links/standalone CTAs — Title Case ("Administrator Portal", "Current Promos", "Back to Home").
- Section eyebrows with `uppercase` CSS — store sentence case, let CSS transform.
- Body copy, errors, status messages, form labels — sentence case ("Could not load the dashboard.", not "Could Not Load The Dashboard.").
- Buttons: uppercase-styled primary/secondary actions — write Title Case in source ("Open Account"). No-uppercase sentence-style buttons — sentence case ("Continue").
- Avoid: inconsistent casing on the same surface, Title Case in body paragraphs, hardcoded ALL CAPS in JSX unless matching an acronym/status badge.

---

## AI VAULT DEFAULT

Applies to any file touching AI features (`**/*ai*.ts`, `**/ai-vault/**`):

1. Use `callMatchFitAi` from `@/lib/ai-vault` — never call Anthropic/OpenAI/Gemini HTTP APIs directly for text generation.
2. Provider order: Claude (auto model) → Gemini primary → Gemini backup → fail.
3. Keys live in `platform_secrets` (AI Vault), never in source.
4. Pick `kind` + optional `complexity` so Claude model auto-selection fits the task.
5. Image generation is free-tier Gemini only (`generateStaticMedia` in `@/lib/content-calendar/media-generation`) — `responseModalities: ["IMAGE"]` + `imageConfig.aspectRatio`, hosted in NI Brain Storage. Nothing routes to OpenAI/DALL·E or any other paid image API, and there is no paid fallback when free quota runs out.
6. See `docs/ai-vault.md` for Hermes and cross-repo standards.

---

## NI BRAIN LEARNING

NI Brain = Northside Intelligence Brain, Supabase project `kxijunwgbrlfzvgkhklo`. On any task
shipping schema, architecture, workflows, or notable product logic:

1. Call/extend `@/lib/ni-brain-client` helpers (`recordNiBrainLearning`, `recordNiBrainDecision`, `recordNiBrainBuildEvent`) for architectural/operational changes.
2. Run `npm run ni-brain:sync` when Prisma models, migrations, or core `src/lib/*` patterns change materially.
3. Version bumps already log via `npm run version:bump` → `scripts/ni-brain-record-version.mjs`.

**Upload:** schema summaries, portal/workflow decisions, lib conventions, operator learnings, product version + reason.
**Never upload:** passwords, API keys, JWTs, `DATABASE_URL`, Stripe secrets, user PII, full source dumps, raw `.env` contents.

Env: `NI_BRAIN_SUPABASE_URL=https://kxijunwgbrlfzvgkhklo.supabase.co`, `NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY` must be the service role from **Northside Intelligence Brain** (`kxijunwgbrlfzvgkhklo`), not the Match Fit app project (`qtesdsxrfggdlxdaraaq`).

Tables: `Context` (build context auto-sync) · `Learnings` · `Decisions` · `arm3_weekly_logs` (`tool_slug=match-fit`) · `match_fit_content_*`.

State on deployable tasks whether NI Brain was updated (synced, learning recorded, or skipped because keys unset).

---

## PRODUCT COPY

**No heavy AI marketing language.** Match Fit uses algorithms/structured signals for discovery
and matching — never position it as an "AI platform" or "AI-powered matching" in user-facing
marketing, legal summaries, onboarding, or homepage copy.

| Prefer | Avoid (user-facing) |
|---|---|
| algorithmic matching | AI matching / AI-assisted matching / AI-powered matching |
| algorithmic surfacing / ranking | "AI learns how you behave" |
| match profile / discovery profile | AI match profile |
| structured questionnaire signals | "AI suggests coaches" |

"AI" is fine only for internal admin/operator tools (AI Assistant, Outreach HQ generation,
content calendar generation) — label as operator tools, not core product marketing. Internal
code names (`aiMatchProfileText`, etc.) can stay; don't surface them to users.

**Fitness Pro vs trainer** — **Fitness Pro(s)** is the canonical label for all non-client
professionals (marketplace, signup, waitlist, admin metrics, directory, Fit Hub author role,
legal defined term, sign-up CTAs). Keep **trainer** only for: assigned coach in a session
("your trainer"), personal-training-industry positioning, service types ("personal training",
CPT badge), and code routes/API fields/DB columns (`/trainer/`). "Trainer Dashboard" →
"Fitness Pro Dashboard" in user-facing nav. Keep Terms/Privacy's defined "Fitness Pro" term
consistent with legal meaning when editing.
