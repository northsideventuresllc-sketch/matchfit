-- Owner/staff account controls (JB, 2026-08-04). Both default false, so no existing account
-- changes behaviour: a real account can be kept out of public discovery without being
-- deactivated, and can be exempted from the platform subscription lifecycle entirely.
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "hiddenFromPublicMarketplace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "platformBillingExempt" BOOLEAN NOT NULL DEFAULT false;
