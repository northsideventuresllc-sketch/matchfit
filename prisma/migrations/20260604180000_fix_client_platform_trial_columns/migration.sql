-- Corrective: original migration targeted "Client" instead of mapped table "clients".
ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "accountDeactivatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
