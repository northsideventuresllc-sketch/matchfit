ALTER TABLE "trainer_profiles"
  ADD COLUMN IF NOT EXISTS "backgroundCheckInviteRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "backgroundCheckInviteSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "backgroundCheckEscrowCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "platformEscrowCents" INTEGER;
