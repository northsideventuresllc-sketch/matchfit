-- Privacy policy acceptance, optional-field visibility toggles, and account de-identification markers.

ALTER TABLE "clients" ADD COLUMN "privacyPolicyAcceptedAt" DATETIME;
ALTER TABLE "clients" ADD COLUMN "optionalProfileVisibilityJson" TEXT;
ALTER TABLE "clients" ADD COLUMN "deidentifiedAt" DATETIME;

ALTER TABLE "trainers" ADD COLUMN "privacyPolicyAcceptedAt" DATETIME;
ALTER TABLE "trainers" ADD COLUMN "optionalProfileVisibilityJson" TEXT;
ALTER TABLE "trainers" ADD COLUMN "deidentifiedAt" DATETIME;

ALTER TABLE "pending_client_registrations" ADD COLUMN "privacyPolicyAcceptedAt" DATETIME;

UPDATE "clients" SET "privacyPolicyAcceptedAt" = "termsAcceptedAt" WHERE "privacyPolicyAcceptedAt" IS NULL;
UPDATE "trainers" SET "privacyPolicyAcceptedAt" = "termsAcceptedAt" WHERE "privacyPolicyAcceptedAt" IS NULL;
UPDATE "pending_client_registrations" SET "privacyPolicyAcceptedAt" = "termsAcceptedAt" WHERE "privacyPolicyAcceptedAt" IS NULL;
