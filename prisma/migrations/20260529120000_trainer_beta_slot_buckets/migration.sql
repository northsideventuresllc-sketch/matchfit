-- Split trainer beta caps into virtual + in-person buckets (30 total max).

ALTER TABLE "public"."trainer_profiles"
  ADD COLUMN "betaSlotVirtualHeld" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "betaSlotInPersonHeld" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."beta_trainer_waitlist_entries"
  ADD COLUMN "desiredOfferingVirtual" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "desiredOfferingInPerson" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "public"."beta_trainer_capacity_notify_state" (
  "id" TEXT NOT NULL,
  "lastEffectiveVirtualMax" INTEGER NOT NULL DEFAULT 20,
  "lastInPersonMax" INTEGER NOT NULL DEFAULT 10,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "beta_trainer_capacity_notify_state_pkey" PRIMARY KEY ("id")
);

INSERT INTO "public"."beta_trainer_capacity_notify_state" ("id", "lastEffectiveVirtualMax", "lastInPersonMax", "updatedAt")
VALUES ('singleton', 20, 10, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Backfill in-person bucket for trainers who already opted in via the match questionnaire.
UPDATE "public"."trainer_profiles" AS p
SET "betaSlotInPersonHeld" = true
FROM "public"."trainers" AS t
WHERE t."id" = p."trainerId"
  AND t."deidentifiedAt" IS NULL
  AND t."internalQaSyntheticPersona" = false
  AND p."matchQuestionnaireAnswers" IS NOT NULL
  AND p."matchQuestionnaireAnswers" LIKE '%"offersInPerson":true%';
