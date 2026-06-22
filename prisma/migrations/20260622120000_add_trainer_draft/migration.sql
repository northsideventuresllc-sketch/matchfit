-- Server-side trainer sign-up draft (resume flow when sessionStorage is lost).
-- Prisma app role bypasses RLS; PostgREST stays locked down.

CREATE TABLE "public"."trainer_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_drafts_userId_key" ON "public"."trainer_drafts"("userId");

CREATE INDEX "trainer_drafts_email_idx" ON "public"."trainer_drafts"("email");

ALTER TABLE "public"."trainer_drafts" ENABLE ROW LEVEL SECURITY;
