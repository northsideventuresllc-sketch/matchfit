# Prisma P1001 drift recovery — 2026-09-07 (4 migrations stuck since 2026-08-13)

**Status: Drift RESOLVED in production on 2026-09-07 (metadata + DDL applied directly via
Supabase MCP, `_prisma_migrations` ledger repaired to match). The build-time root cause below
is NOT fixed — it needs a Vercel dashboard env var change and is flagged for follow-up.**

## What was wrong (plain English)

The `match-fit-tos-jobs` cron started throwing on 2026-09-07 16:15 UTC:

```
PrismaClientKnownRequestError: Invalid prisma.trainerDraft.findMany() invocation:
The column trainer_drafts.resumeEmailSentAt does not exist in the current database. code: P2022
```

`resumeEmailSentAt` was added to `prisma/schema.prisma` and its migration
(`20260722193000_trainer_draft_resume_email_sent_at`) merged to `main` today in PR #365, but
had never reached production.

This was not an isolated miss. `prisma migrate deploy` against prod
(`qtesdsxrfggdlxdaraaq`) has been silently failing on **every** Vercel production build since
2026-08-13, with:

```
Error: P1001: Can't reach database server at `db.qtesdsxrfggdlxdaraaq.supabase.co:5432`
[maybe-migrate-deploy] prisma migrate deploy failed; continuing build. Runtime sign-up self-heal will apply trial columns if needed.
```

(confirmed in the build log for deployment `dpl_D4oxEzuSPiDuZ5S9CERJEssDpBdu`, the PR #365
production deploy). `scripts/maybe-migrate-deploy.mjs` swallows that failure by design (same
pattern as the 2026-07-06 P3009 incident) so the app keeps shipping — but no migration has
landed via the normal path in ~3.5 weeks. Four migrations had piled up unapplied:

- `20260722193000_trainer_draft_resume_email_sent_at`
- `20260831120000_outreach_send_mode`
- `20260904190000_outreach_conversions`
- `20260906210000_pending_trainer_resume_signup_nudges`

## Root cause

`prisma.config.ts` points the migration datasource at `DIRECT_URL` (falling back to
`DATABASE_URL`), used raw — it does **not** go through the pooler-derivation helper in
`src/lib/supabase-database-url.ts` that the runtime Prisma client uses. Whatever `DIRECT_URL`
is currently set to in Vercel resolves to `db.qtesdsxrfggdlxdaraaq.supabase.co:5432`, the
direct Postgres host. Supabase direct-connection hosts are IPv6-only unless the project pays
for the IPv4 add-on; Vercel's build network is IPv4-only. Build-time `migrate deploy` can
never reach that host, so it fails every time — quietly, because of the swallow-and-continue
design.

This is a different failure mode from the 2026-07-06 incident (P3009, a stuck failed-migration
row) but the same underlying pattern the earlier runbook already named as the danger: a
build-time migration failure that gets hidden, so drift accumulates until a cron or route hits
a missing column.

## What was verified before touching anything (read-only, 2026-09-07)

1. `_prisma_migrations` had **116** applied rows, none failed/unresolved, latest
   `20260812200000_trainer_payout_requests` (finished 2026-08-13 03:25 UTC).
2. Diffed against all 120 local `prisma/migrations/*` folders → exactly the 4 migrations
   above were missing, all newer than 2026-08-13.
3. Read each pending migration's SQL: all four are additive only (`ADD COLUMN IF NOT EXISTS`,
   `CREATE INDEX IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) except the last, a plain
   `CREATE TABLE pending_trainer_resume_signup_nudges` — confirmed via
   `to_regclass('public.pending_trainer_resume_signup_nudges')` that table did not already
   exist, so no conflict risk running it as-is. `outreach_lead_touch_log` (from the
   `outreach_conversions` migration) already existed out-of-band, which is why that migration's
   `CREATE TABLE IF NOT EXISTS` was safe to run.
4. Confirmed Prisma's migration checksum algorithm is a plain `sha256sum` of the migration
   file (verified against the already-applied `20260812200000_trainer_payout_requests` row).

## What was changed in prod

1. Applied the SQL from all 4 pending migrations, in order, via Supabase MCP
   (`apply_migration`) — the same DDL Prisma would have run, executed through a path that
   can actually reach the database.
2. Inserted matching rows into `_prisma_migrations` (correct `sha256` checksum per file,
   `applied_steps_count = 1`) so the ledger reflects reality and the next successful
   `prisma migrate deploy` treats these as already-applied rather than re-running or
   flagging drift.

Post-fix: **120 applied migrations**, matching `prisma/migrations/` exactly.
`trainer_drafts.resumeEmailSentAt` confirmed present via `information_schema.columns`.

## Verification

- `information_schema.columns` confirms `trainer_drafts.resumeEmailSentAt` exists.
- Vercel runtime logs for the 16:45 and 17:00 UTC cron runs (both **before** the fix landed)
  still show the P2022 error, as expected. The fix was applied ~17:03 UTC; the cron runs every
  15 minutes via NI-Brain pg_cron (`mf-tos-cron`), so the 17:15 UTC run is the first clean
  opportunity — confirm no P2022 in Vercel runtime logs (`get_runtime_logs`, query
  `match-fit-tos-jobs`) after that time.

## NOT fixed — needs a human with Vercel dashboard access

The P1001 root cause is still live. Every future production build will keep failing to run
`prisma migrate deploy` and keep silently swallowing it, until `DIRECT_URL` (production
environment, Vercel project `matchfit`) is changed away from the direct
`db.qtesdsxrfggdlxdaraaq.supabase.co:5432` host to the Supabase **Session Pooler** endpoint for
this project (port 5432, IPv4-reachable, supports the advisory locks `migrate deploy` needs —
unlike the transaction pooler on 6543, which is what `DATABASE_URL` should keep using for the
app). No agent in this session has Vercel env var write access, so this needs a manual dashboard
edit. This repo's tools have no env-var-write MCP path either — confirm this is genuinely a
JB/dashboard-only fix before assuming otherwise.

Until that's fixed, treat every future schema migration the same way this one was recovered:
verify drift via `_prisma_migrations` vs `prisma/migrations/`, apply by hand, record it in the
ledger — same as this doc and the 2026-07-06 P3009 runbook.

## Replay runbook (if this happens again)

```bash
# 1. Compare applied vs local migrations (read-only, always safe)
#    Supabase MCP: select migration_name from "_prisma_migrations" where rolled_back_at is null order by migration_name;
#    vs: ls prisma/migrations

# 2. For each missing migration, read its SQL. If it's all IF NOT EXISTS / idempotent,
#    it's safe to apply directly. For a plain CREATE TABLE/ALTER without IF NOT EXISTS,
#    confirm the target object doesn't already exist first (to_regclass, information_schema).

# 3. Apply each migration's SQL in order (Supabase MCP apply_migration, or psql against the
#    session pooler if reachable).

# 4. Record each one in the ledger so migrate deploy doesn't re-run or flag drift:
#    insert into "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
#    values (gen_random_uuid()::text, '<sha256sum of migration.sql>', '<folder name>', now(), now(), 1);
```
