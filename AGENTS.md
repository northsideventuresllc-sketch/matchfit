<!-- BEGIN:ni-context-protocol -->
## LOAD CONTEXT FIRST — before any code work

You are working inside the NORTHSiDE Intelligence (NI) ecosystem. Before touching any code:

1. **Read the master state file** from the vault:
   `~/Desktop/Desktop/Northside Ventures/Obsidian Vault/Northside Ventures Group Vault/_Command Center/NI-Master-Context.md`
   — This has today's date, all project statuses, and critical open items.

2. **Query NI-Brain** (Supabase project `kxijunwgbrlfzvgkhklo`):
   - Recent Decisions (last 7 days)
   - Recent Learnings (last 3 days)
   - Filter for Match Fit or Sector 1A

3. **Check Match Fit vault notes:**
   `NORTHSiDE Intelligence (NI)/Sector 1A — Tech Ventures/Match Fit/Tasks.md`

4. Then read this file's technical sections below.

**Write-back after work:** Log any [DECISION] [LEARNED] [CORRECTION] to NI-Brain Learnings/Decisions tables. Never ask JB to re-explain anything in the vault.

**Operator:** Jonny (JB) — never Jonathan. Brand: `NORTHSiDE` — exact casing always.
<!-- END:ni-context-protocol -->

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

This is a Next.js 16 monolithic app (App Router + Turbopack) serving client, trainer, and admin portals. The only required local service beyond the Next.js server is PostgreSQL.

### Local PostgreSQL setup

The update script does NOT start PostgreSQL. Before running the dev server or integration tests, ensure PostgreSQL is running:

```bash
sudo pg_ctlcluster 16 main start
```

The local dev database uses `postgresql://matchfit:matchfit@localhost:5432/matchfit`. After starting Postgres, apply the schema with `npm run db:push` (runs `prisma generate` then `prisma db push`).

### Prisma ORM v7

- Client is generated to `src/generated/prisma` (`provider = "prisma-client"` in `prisma/schema.prisma`). CLI connection URLs live in `prisma.config.ts` (`DIRECT_URL` preferred, then `DATABASE_URL`).
- Runtime uses Direct TCP via `@prisma/adapter-pg` — import `prisma` only from server code (`@/lib/prisma`). Pure offering/questionnaire helpers live in `@/lib/trainer-service-offerings-document` (safe for `"use client"` modules).
- `npm run build` / `postinstall` run `prisma generate`. Builds without `DATABASE_URL` use a placeholder connection string during page-data collection only.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Push schema | `npm run db:push` |
| Apply migrations (production) | `npm run db:migrate` |
| Beta launch local setup | `npm run beta:setup` (creates `.env`, enables gates, `db push`) |
| Beta production env check | `npm run beta:preflight:production` (after Stripe/Resend keys in `.env`) |
| Push beta env to Vercel | `npm run beta:vercel-env` (after `npx vercel link`) |
| Client VIP Stripe price | `npm run stripe:setup:client-vip` then `VERCEL_TOKEN=... npm run vercel:env:client-vip` |

### Scheduled jobs (waitlist + TOS cron)

`vercel.json` intentionally has **no** `crons` entry: Vercel **Hobby** rejects deploys when a cron runs more than once per day (`*/15 * * * *` fails at deploy time).

- **Hobby / default:** GitHub Actions workflow `.github/workflows/match-fit-tos-cron.yml` calls `GET /api/cron/match-fit-tos-jobs` every 15 minutes. Set repo secrets `CRON_SECRET` and `MATCH_FIT_APP_URL` (production URL, no trailing slash).
- **Vercel Pro:** You may copy `vercel.cron.pro.example.json` into `vercel.json` instead and rely on Vercel Cron.
| Seed admin | `MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' node --env-file=.env scripts/seed-bootstrap-admin.js` |

### Environment variables

Copy `.env.example` to `.env`. At minimum set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`. Set `MATCH_FIT_COOKIE_SECURE=0` for local HTTP. External services (Stripe, Supabase Auth, Resend, OpenAI) are optional for local dev — the app gracefully degrades without them.

### Testing notes

- Unit tests (`npm run test`) mock `next/headers` and delete `DATABASE_URL` unless `TEST_DATABASE_URL` is set. Most tests are pure logic tests and pass without a database.
- The `login-2fa.integration.test.ts` suite runs `prisma db push` itself when `DATABASE_URL` (or `TEST_DATABASE_URL`) is available — it just needs a running Postgres instance.
- ESLint uses flat config (`eslint.config.mjs`) with `eslint-config-next` — run via `npm run lint`.

### Admin login for manual testing

After seeding, admin portal is at `/admin/login`. Use staff code `jobo0602` with the password you set during seeding.

### Supabase Row Level Security

Sensitive tables (admin, outreach, analytics, secrets) use **RLS deny-by-default** for PostgREST `anon`/`authenticated` roles. See `docs/supabase-rls-sensitive-tables.md` and migration `20260703120000_enable_rls_audit_sensitive_tables`. Server routes must continue using **Prisma** (`DATABASE_URL`) — not the browser Supabase client — for these tables.

### Social content calendar (agents)

- Canonical file: `content/social/matchfit-content-calendar.jsx`
- Sync from parent hub: `npm run content:calendar:sync` (see `content/social/README.md`)
- Skill: `.cursor/skills/matchfit-social-content/SKILL.md`

### Product version (required on deployable tasks)

Match Fit uses `major.minor.patch` with optional **BETA** (`package.json` → `src/lib/match-fit-product-version.ts`). **Bump on every production deploy** in the same PR — the owner does not need to ask.

| Level | When |
|-------|------|
| `major` | Transformative changes (e.g. multiple new marketplaces, platform pivot) |
| `minor` | Notable features or redesigns (e.g. admin portal, dashboard redesign) |
| `patch` | Bug fixes, copy polish, small UX tweaks |

```bash
npm run version:bump -- patch --reason "Fix client signup validation"
npm run version:verify   # CI enforces bump when product paths change
```

- Full categorization guide: `docs/MATCH_FIT_PRODUCT_VERSION.md`
- Cursor rule (always on): `.cursor/rules/product-version.mdc`
- **Owner approval only:** adding/removing BETA or changing version structure
- **Task completion:** state explicitly that the product version was updated (old → new, level used)
- Never hardcode version strings in UI — use `MATCH_FIT_PRODUCT_VERSION_LABEL` / `MATCH_FIT_PRODUCT_VERSION_ANNOUNCE`


## Slack posting rule (added 2026-08-19, JB direct order)

Every agent posts status/updates to Slack through ONE method only — never your own personal/native Slack connection:

```
POST https://kxijunwgbrlfzvgkhklo.supabase.co/functions/v1/slack-post
Header: Authorization: Bearer sb_publishable_-JPXXSn9eyX9BxdvIzTulw_QkHPIERR
Content-Type: application/json
Body: {"channel":"C0BR6ATGHGR","text":"<your message>"}
```

C0BR6ATGHGR is the only #agent-ops channel JB watches. Do not post to any other channel ID, and do not use a native/per-session Slack app connection for agent status posts.

