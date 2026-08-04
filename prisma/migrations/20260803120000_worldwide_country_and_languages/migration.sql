-- Worldwide availability (NI-Brain Decision #452), applied on top of main's worldwide signup change.
--
-- ADDITIVE + NULLABLE-RELAXING ONLY. Nothing is dropped and no data is lost.
--
-- `zipCode` becomes nullable because several countries have NO postal code system at all
-- (notably the United Arab Emirates, which is on the first-tier marketing list). Requiring a
-- postal there is a field the user physically cannot fill.
--
-- Existing rows are backfilled countryCode='US', which is safe: every account created before
-- this point passed the old US-ZIP wall, so the US is the only country they could have been.

ALTER TABLE "public"."clients" ALTER COLUMN "zipCode" DROP NOT NULL;
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

ALTER TABLE "public"."pending_client_registrations" ALTER COLUMN "zipCode" DROP NOT NULL;
ALTER TABLE "public"."pending_client_registrations" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "public"."trainer_profiles"
  ADD COLUMN IF NOT EXISTS "spokenLanguageCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "public"."clients"
SET "countryCode" = 'US'
WHERE "countryCode" IS NULL;

UPDATE "public"."pending_client_registrations"
SET "countryCode" = 'US'
WHERE "countryCode" IS NULL;

UPDATE "public"."trainer_profiles"
SET "countryCode" = 'US'
WHERE "countryCode" IS NULL AND "serviceZipCode" IS NOT NULL;
