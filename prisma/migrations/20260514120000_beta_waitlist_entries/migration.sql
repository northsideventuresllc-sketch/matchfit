-- Beta Atlanta waitlist entries (Prisma app role bypasses RLS; PostgREST stays locked down.)

CREATE TABLE "public"."beta_trainer_waitlist_entries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "desiredUsername" TEXT NOT NULL,
    "serviceZipCode" TEXT NOT NULL,
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3),
    "slotExpiresAt" TIMESTAMP(3),
    "registeredTrainerId" TEXT,

    CONSTRAINT "beta_trainer_waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_trainer_waitlist_entries_inviteToken_key" ON "public"."beta_trainer_waitlist_entries"("inviteToken");

CREATE UNIQUE INDEX "beta_trainer_waitlist_entries_registeredTrainerId_key" ON "public"."beta_trainer_waitlist_entries"("registeredTrainerId");

CREATE INDEX "beta_trainer_waitlist_entries_status_createdAt_idx" ON "public"."beta_trainer_waitlist_entries"("status", "createdAt");

CREATE INDEX "beta_trainer_waitlist_entries_email_idx" ON "public"."beta_trainer_waitlist_entries"("email");

CREATE INDEX "beta_trainer_waitlist_entries_desiredUsername_idx" ON "public"."beta_trainer_waitlist_entries"("desiredUsername");

CREATE TABLE "public"."beta_client_waitlist_entries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "desiredUsername" TEXT NOT NULL,
    "homeZipCode" TEXT NOT NULL,
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3),
    "slotExpiresAt" TIMESTAMP(3),
    "registeredClientId" TEXT,

    CONSTRAINT "beta_client_waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_client_waitlist_entries_inviteToken_key" ON "public"."beta_client_waitlist_entries"("inviteToken");

CREATE UNIQUE INDEX "beta_client_waitlist_entries_registeredClientId_key" ON "public"."beta_client_waitlist_entries"("registeredClientId");

CREATE INDEX "beta_client_waitlist_entries_status_createdAt_idx" ON "public"."beta_client_waitlist_entries"("status", "createdAt");

CREATE INDEX "beta_client_waitlist_entries_email_idx" ON "public"."beta_client_waitlist_entries"("email");

CREATE INDEX "beta_client_waitlist_entries_desiredUsername_idx" ON "public"."beta_client_waitlist_entries"("desiredUsername");

ALTER TABLE "public"."beta_trainer_waitlist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."beta_client_waitlist_entries" ENABLE ROW LEVEL SECURITY;
