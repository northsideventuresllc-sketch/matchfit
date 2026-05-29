-- Founding coach sales rebate: first 30 trainers earn 5% back on first 5 app sales through 2026.

ALTER TABLE "public"."trainers"
  ADD COLUMN "foundingTrainerSignupRank" INTEGER;

ALTER TABLE "public"."trainer_client_service_transactions"
  ADD COLUMN "foundingSalesBonusCents" INTEGER,
  ADD COLUMN "foundingSalesBonusGrantedAt" TIMESTAMP(3);

-- Backfill founding signup rank for existing real trainers (same exclusions as launch counters).
WITH ranked AS (
  SELECT
    t."id" AS trainer_id,
    ROW_NUMBER() OVER (ORDER BY t."createdAt" ASC) AS rank
  FROM "public"."trainers" AS t
  WHERE t."deidentifiedAt" IS NULL
    AND t."internalQaSyntheticPersona" = false
    AND t."username" NOT ILIKE 'mfqst_%'
    AND t."email" NOT ILIKE '%@internal.match-fit.invalid'
    AND t."email" NOT ILIKE '%.invalid'
)
UPDATE "public"."trainers" AS t
SET "foundingTrainerSignupRank" = ranked.rank
FROM ranked
WHERE t."id" = ranked.trainer_id
  AND ranked.rank <= 30;
