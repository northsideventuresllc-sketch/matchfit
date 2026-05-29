-- Founding trainer sales bonus: signup rank on trainers + bonus audit on service transactions.

ALTER TABLE "trainers" ADD COLUMN "foundingTrainerSignupRank" INTEGER;

ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "foundingSalesBonusCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "foundingSalesBonusGrantedAt" TIMESTAMP(3);

-- Backfill signup ranks for existing launch trainers (first 30 by createdAt, excluding synthetic QA rows).
WITH ranked AS (
  SELECT
    t.id,
    ROW_NUMBER() OVER (ORDER BY t."createdAt" ASC) AS rn
  FROM trainers t
  WHERE t."deidentifiedAt" IS NULL
    AND t."internalQaSyntheticPersona" = false
    AND t.email NOT ILIKE '%@internal.match-fit.invalid'
    AND t.email NOT ILIKE '%.invalid'
    AND t.username NOT ILIKE 'mfqst_%'
)
UPDATE trainers tr
SET "foundingTrainerSignupRank" = ranked.rn
FROM ranked
WHERE tr.id = ranked.id
  AND ranked.rn <= 30;
