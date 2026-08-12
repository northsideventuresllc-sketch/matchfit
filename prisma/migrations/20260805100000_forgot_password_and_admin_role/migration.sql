-- Forgot password + login security (JB, 2026-08-05). Additive only, nothing dropped.

ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "passwordChangeCount24h" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "passwordChangeWindowStartsAt" TIMESTAMP(3);
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "securityLockedAt" TIMESTAMP(3);
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "securityLockReason" TEXT;

ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "passwordChangeCount24h" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "passwordChangeWindowStartsAt" TIMESTAMP(3);
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "securityLockedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "securityLockReason" TEXT;

-- Administrator had no password-change or role infrastructure at all before this.
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "passwordChangeNonce" TEXT;
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "passwordChangeExpires" TIMESTAMP(3);
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "passwordChangeCount24h" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "passwordChangeWindowStartsAt" TIMESTAMP(3);
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "securityLockedAt" TIMESTAMP(3);
ALTER TABLE "public"."administrators" ADD COLUMN IF NOT EXISTS "securityLockReason" TEXT;
