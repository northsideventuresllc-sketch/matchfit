-- Account deletion grace period (client + trainer login and settings).
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "accountDeletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accountDeletionFinalizeAt" TIMESTAMP(3);

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "accountDeletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accountDeletionFinalizeAt" TIMESTAMP(3);
