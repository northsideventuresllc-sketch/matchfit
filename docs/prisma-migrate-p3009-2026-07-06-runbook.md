# Prisma P3009 recovery — 2026-07-06 (stuck migration `20260527160000_admin_audit_platform_revenue`)

**Status: RESOLVED in production on 2026-07-06. No action needed on prod. This doc is the record + replay runbook.**

## What was wrong (plain English)

Since **2026-06-04**, `prisma migrate deploy` against the production Supabase database
(`qtesdsxrfggdlxdaraaq`, the trainer/client DB) has been failing with **P3009**
("migrate found failed migrations"). The Vercel build script
(`scripts/maybe-migrate-deploy.mjs`) swallows that failure and continues the build, so the
app kept shipping — but **no new migration has actually reached prod via migrate deploy
since then**. New schema changes only landed because someone applied the SQL out-of-band
(e.g. via the Supabase dashboard/MCP), which is exactly the pattern that caused the failure
in the first place.

The stuck record: migration `20260527160000_admin_audit_platform_revenue` failed with
`42P07 relation "administrator_audit_logs" already exists` — its two tables had already
been created out-of-band before the migration ran. Prisma left the ledger row in the
`_prisma_migrations` table with `finished_at IS NULL` and `rolled_back_at IS NULL`, which
blocks every subsequent `migrate deploy`.

## What was verified before touching anything (dry-run evidence)

All checks were read-only SQL against prod, run 2026-07-06:

1. `_prisma_migrations` had exactly **one** unresolved failed row:
   `20260527160000_admin_audit_platform_revenue` (started 2026-06-04, never finished,
   never rolled back). Six older failures had already been resolved historically.
2. Every object that migration creates **already exists** in prod:
   tables `administrator_audit_logs`, `platform_revenue_events`; unique index
   `platform_revenue_events_idempotencyKey_key`; indexes
   `administrator_audit_logs_administratorId_createdAt_idx`,
   `administrator_audit_logs_targetRole_targetId_createdAt_idx`,
   `platform_revenue_events_category_createdAt_idx`; FK
   `administrator_audit_logs_administratorId_fkey`.
3. The one migration in the repo that post-dates the blockage,
   `20260706180000_enable_rls_fp_tier_tables`, had **already been applied out-of-band**
   (all 8 FP tier tables show `relrowsecurity = true`) but was missing from the ledger.

Because everything already existed, the safe resolve path was **metadata-only** — no DDL,
no data touched, nothing dropped.

## What was changed in prod (metadata only, `_prisma_migrations` ledger)

1. Marked `20260527160000_admin_audit_platform_revenue` as applied
   (set `finished_at`, `applied_steps_count = 1`, cleared `logs`) — the SQL equivalent of
   `npx prisma migrate resolve --applied 20260527160000_admin_audit_platform_revenue`.
2. Inserted a ledger row for `20260706180000_enable_rls_fp_tier_tables` with the correct
   sha256 checksum, since its DDL was already live — equivalent of
   `npx prisma migrate resolve --applied 20260706180000_enable_rls_fp_tier_tables`.

Post-fix state: **0 unresolved failed migrations, 96 distinct applied migrations**, which
matches the repo's `prisma/migrations/` exactly except for one known drift item (below).
The next `prisma migrate deploy` (next Vercel prod build) should be a clean no-op and
future migrations will deploy normally again.

## Replay runbook (if P3009 happens again, or for a restored copy of this DB)

```bash
# 1. See what is stuck (read-only, always safe)
npx prisma migrate status

# 2. Verify the failed migration's objects already exist before resolving.
#    For THIS incident the idempotent repair SQL is:
#    scripts/fix-prisma-p3009-20260527160000-admin-audit-platform-revenue.sql
#    (safe to run even if everything exists — every statement is IF NOT EXISTS)

# 3. Mark the failed migration as applied (metadata only)
npx prisma migrate resolve --applied 20260527160000_admin_audit_platform_revenue

# 4. Deploy the rest
npx prisma migrate deploy
```

If the objects do **not** all exist, do not use `--applied`; run the repair SQL first
(step 2), then resolve, then deploy.

## Known drift (not fixed here, flagged for follow-up)

- `20260518120000_launch_cohort_and_trials` is applied in prod but the migration folder
  was deleted from the repo (commit `297e47e`). Harmless to `migrate deploy` (Prisma
  ignores DB-only history), but `migrate status`/`migrate dev` will warn. Options: restore
  the folder from git history, or accept the warning.
- The `DATABASE_URL` secret available to Cloud Agents fails Prisma auth (P1000) against
  the pooler (`postgres.qtesdsxrfggdlxdaraaq@aws-1-us-east-2.pooler.supabase.com:5432`).
  It likely holds a stale password. Verification for this fix was done via Supabase MCP
  instead. Worth rotating the secret so `prisma migrate status` works from agents.

## Root-cause note (why this keeps happening)

Five of the seven historical failures are "already exists / already applied" errors —
schema changes applied out-of-band (dashboard/MCP/hotfix SQL) before the migration ran.
Rule of thumb: if SQL must be hot-applied to prod, immediately record it with
`npx prisma migrate resolve --applied <name>` so the ledger stays truthful and
`maybe-migrate-deploy` doesn't silently no-op for weeks.
