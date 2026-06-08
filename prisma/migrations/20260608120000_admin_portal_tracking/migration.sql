-- Signup form progress for admin pipelines
CREATE TABLE "public"."signup_form_progress" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "fieldsJson" TEXT NOT NULL DEFAULT '{}',
    "stage" TEXT NOT NULL DEFAULT 'started_signup',

    CONSTRAINT "signup_form_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signup_form_progress_role_visitorId_key" ON "public"."signup_form_progress"("role", "visitorId");
CREATE INDEX "signup_form_progress_role_stage_idx" ON "public"."signup_form_progress"("role", "stage");
CREATE INDEX "signup_form_progress_updatedAt_idx" ON "public"."signup_form_progress"("updatedAt");

-- Transactional email delivery audit
CREATE TABLE "public"."transactional_email_deliveries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resendId" TEXT,
    "errorMessage" TEXT,
    "clientId" TEXT,
    "trainerId" TEXT,

    CONSTRAINT "transactional_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transactional_email_deliveries_createdAt_idx" ON "public"."transactional_email_deliveries"("createdAt");
CREATE INDEX "transactional_email_deliveries_kind_createdAt_idx" ON "public"."transactional_email_deliveries"("kind", "createdAt");
CREATE INDEX "transactional_email_deliveries_status_createdAt_idx" ON "public"."transactional_email_deliveries"("status", "createdAt");

-- Support inbox (Resend inbound webhook)
CREATE TABLE "public"."support_inbox_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resendEmailId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',

    CONSTRAINT "support_inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_inbox_messages_resendEmailId_key" ON "public"."support_inbox_messages"("resendEmailId");
CREATE INDEX "support_inbox_messages_createdAt_idx" ON "public"."support_inbox_messages"("createdAt");
CREATE INDEX "support_inbox_messages_status_createdAt_idx" ON "public"."support_inbox_messages"("status", "createdAt");
