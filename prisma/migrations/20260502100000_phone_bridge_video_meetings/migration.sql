-- Masked-call opt-in + booking video conference metadata + trainer OAuth connection store

ALTER TABLE "clients" ADD COLUMN "allowPhoneBridge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN "allowPhoneBridgeConsentAt" DATETIME;

ALTER TABLE "trainers" ADD COLUMN "allowPhoneBridge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainers" ADD COLUMN "allowPhoneBridgeConsentAt" DATETIME;

ALTER TABLE "booked_training_sessions" ADD COLUMN "videoConferenceJoinUrl" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "videoConferenceProvider" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "videoConferenceExternalId" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "videoConferenceSyncedAt" DATETIME;

CREATE TABLE "trainer_video_conference_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trainerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedOAuthBundle" TEXT NOT NULL,
    "accessTokenExpiresAt" DATETIME,
    "externalAccountHint" TEXT,
    "revokedAt" DATETIME,
    CONSTRAINT "trainer_video_conference_connections_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_video_conference_connections_trainerId_provider_key" ON "trainer_video_conference_connections"("trainerId", "provider");
CREATE INDEX "trainer_video_conference_connections_trainerId_idx" ON "trainer_video_conference_connections"("trainerId");
