-- Repair DB after failed migration `20260527160000_admin_audit_platform_revenue` (Prisma P3009).
-- Failure mode on 2026-06-04: `relation "administrator_audit_logs" already exists` (42P07) —
-- the tables had already been created out-of-band, so the migration failed at step 0 and the
-- ledger row was left with finished_at IS NULL and rolled_back_at IS NULL, blocking every
-- subsequent `prisma migrate deploy`.
--
-- Idempotent: safe if any or all objects already exist.
--
-- After this succeeds:
--   npx prisma migrate resolve --applied 20260527160000_admin_audit_platform_revenue
--   npx prisma migrate deploy
--
-- Applied to production (Supabase qtesdsxrfggdlxdaraaq) on 2026-07-06 via metadata-only
-- resolve — all objects below were verified to already exist, so no DDL was run there.
-- See docs/prisma-migrate-p3009-2026-07-06-runbook.md.

CREATE TABLE IF NOT EXISTS "public"."administrator_audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administratorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUsername" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "administrator_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."platform_revenue_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "revenueCents" INTEGER NOT NULL,
    "grossProfitCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "clientId" TEXT,
    "trainerId" TEXT,
    "metaJson" TEXT,

    CONSTRAINT "platform_revenue_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_revenue_events_idempotencyKey_key" ON "public"."platform_revenue_events"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "administrator_audit_logs_administratorId_createdAt_idx" ON "public"."administrator_audit_logs"("administratorId", "createdAt");

CREATE INDEX IF NOT EXISTS "administrator_audit_logs_targetRole_targetId_createdAt_idx" ON "public"."administrator_audit_logs"("targetRole", "targetId", "createdAt");

CREATE INDEX IF NOT EXISTS "platform_revenue_events_category_createdAt_idx" ON "public"."platform_revenue_events"("category", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'administrator_audit_logs_administratorId_fkey'
    ) THEN
        ALTER TABLE "public"."administrator_audit_logs"
            ADD CONSTRAINT "administrator_audit_logs_administratorId_fkey"
            FOREIGN KEY ("administratorId") REFERENCES "public"."administrators"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
