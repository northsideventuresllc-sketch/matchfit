-- Repair DB after failed migration `20260513140000_web_push_and_remove_twilio_sms`
-- (e.g. `web_push_subscriptions` already exists but migration never finished).
-- Safe to re-run.
--
-- Then clear Prisma’s failed flag if needed, mark applied, deploy:
--   npx prisma migrate resolve --rolled-back 20260513140000_web_push_and_remove_twilio_sms
--   npx prisma migrate resolve --applied 20260513140000_web_push_and_remove_twilio_sms
--   npx prisma migrate deploy

CREATE TABLE IF NOT EXISTS "public"."web_push_subscriptions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "clientId" TEXT,
    "trainerId" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "web_push_subscriptions_endpoint_key" ON "public"."web_push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "web_push_subscriptions_clientId_idx" ON "public"."web_push_subscriptions"("clientId");
CREATE INDEX IF NOT EXISTS "web_push_subscriptions_trainerId_idx" ON "public"."web_push_subscriptions"("trainerId");

DO $$
BEGIN
  ALTER TABLE "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."web_push_subscriptions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_fit_client_scope_web_push_subscriptions" ON "public"."web_push_subscriptions";
CREATE POLICY "match_fit_client_scope_web_push_subscriptions"
  ON "public"."web_push_subscriptions"
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_client_id() IS NOT NULL
    AND "web_push_subscriptions"."clientId" = public.match_fit_jwt_client_id()
    AND "web_push_subscriptions"."trainerId" IS NULL
  )
  WITH CHECK (
    public.match_fit_jwt_client_id() IS NOT NULL
    AND "web_push_subscriptions"."clientId" = public.match_fit_jwt_client_id()
    AND "web_push_subscriptions"."trainerId" IS NULL
  );

DROP POLICY IF EXISTS "match_fit_trainer_scope_web_push_subscriptions" ON "public"."web_push_subscriptions";
CREATE POLICY "match_fit_trainer_scope_web_push_subscriptions"
  ON "public"."web_push_subscriptions"
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND "web_push_subscriptions"."trainerId" = public.match_fit_jwt_trainer_id()
    AND "web_push_subscriptions"."clientId" IS NULL
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND "web_push_subscriptions"."trainerId" = public.match_fit_jwt_trainer_id()
    AND "web_push_subscriptions"."clientId" IS NULL
  );

UPDATE "public"."client_two_factor_channels" AS t
SET "delivery" = 'EMAIL',
    "email" = LOWER(TRIM(c."email")),
    "phone" = NULL
FROM "public"."clients" AS c
WHERE t."clientId" = c."id" AND t."delivery" IN ('SMS', 'VOICE');

UPDATE "public"."trainer_two_factor_channels" AS t
SET "delivery" = 'EMAIL',
    "email" = LOWER(TRIM(tr."email")),
    "phone" = NULL
FROM "public"."trainers" AS tr
WHERE t."trainerId" = tr."id" AND t."delivery" IN ('SMS', 'VOICE');

UPDATE "public"."clients" SET "twoFactorMethod" = 'EMAIL' WHERE "twoFactorMethod" IN ('SMS', 'VOICE');
UPDATE "public"."trainers" SET "twoFactorMethod" = 'EMAIL' WHERE "twoFactorMethod" IN ('SMS', 'VOICE');
UPDATE "public"."pending_client_registrations" SET "twoFactorMethod" = 'EMAIL' WHERE "twoFactorMethod" IN ('SMS', 'VOICE');

ALTER TABLE "public"."clients" DROP COLUMN IF EXISTS "allowPhoneBridge";
ALTER TABLE "public"."clients" DROP COLUMN IF EXISTS "allowPhoneBridgeConsentAt";
ALTER TABLE "public"."trainers" DROP COLUMN IF EXISTS "allowPhoneBridge";
ALTER TABLE "public"."trainers" DROP COLUMN IF EXISTS "allowPhoneBridgeConsentAt";
