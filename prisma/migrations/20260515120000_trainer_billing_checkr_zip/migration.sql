-- Trainer Checkr amounts, registration fee tracking, service ZIP

ALTER TABLE "public"."trainer_profiles"
  ADD COLUMN IF NOT EXISTS "backgroundCheckVendorPaidCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "checkrCandidateId" TEXT,
  ADD COLUMN IF NOT EXISTS "checkrReportId" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationFeePricingMode" TEXT NOT NULL DEFAULT 'FOUNDING_BG_SURCHARGE_20PCT',
  ADD COLUMN IF NOT EXISTS "hasPaidRegistrationFee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "registrationFeePaidCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "serviceZipCode" TEXT;
