-- Internal QA sandbox: synthetic personas, FitHub sandbox posts, daily sim cursors, deferred chat opens.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "internalQaSyntheticPersona" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "internalQaSyntheticPersona" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN IF NOT EXISTS "internalQaSandboxPost" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "internal_qa_client_daily_cursors" (
    "clientId" TEXT NOT NULL,
    "estDayKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "internal_qa_client_daily_cursors_pkey" PRIMARY KEY ("clientId")
);

CREATE TABLE IF NOT EXISTS "internal_qa_trainer_daily_cursors" (
    "trainerId" TEXT NOT NULL,
    "estDayKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "internal_qa_trainer_daily_cursors_pkey" PRIMARY KEY ("trainerId")
);

CREATE TABLE IF NOT EXISTS "internal_qa_deferred_official_chats" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "openAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "internal_qa_deferred_official_chats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "internal_qa_deferred_official_chats_conversationId_key"
  ON "internal_qa_deferred_official_chats"("conversationId");

CREATE INDEX IF NOT EXISTS "internal_qa_deferred_official_chats_openAt_processedAt_idx"
  ON "internal_qa_deferred_official_chats"("openAt", "processedAt");

DO $$
BEGIN
  ALTER TABLE "internal_qa_client_daily_cursors"
    ADD CONSTRAINT "internal_qa_client_daily_cursors_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "internal_qa_trainer_daily_cursors"
    ADD CONSTRAINT "internal_qa_trainer_daily_cursors_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "internal_qa_deferred_official_chats"
    ADD CONSTRAINT "internal_qa_deferred_official_chats_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "trainer_client_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
