-- Outreach HQ: Instagram, Facebook, email, and other trainer outreach leads.

CREATE TABLE "outreach_instagram_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "dmText" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "commentPostRef" TEXT,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "followUp1SentAt" TIMESTAMP(3),
    "followUp2SentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "dmTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "commentTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_instagram_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_facebook_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'TRAINER',
    "niche" TEXT,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "pagePostText" TEXT NOT NULL,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "pagePostTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_facebook_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_email_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessName" TEXT,
    "niche" TEXT,
    "emailSourceUrl" TEXT,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "followUp1SentAt" TIMESTAMP(3),
    "followUp2SentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "emailBodyEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_email_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_other_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "contactLabel" TEXT NOT NULL,
    "contactUrl" TEXT,
    "channelNotes" TEXT,
    "niche" TEXT,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "outreachText" TEXT NOT NULL,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "followUp1SentAt" TIMESTAMP(3),
    "followUp2SentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "outreachTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_other_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_learning_signals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "leadId" TEXT,
    "originalText" TEXT,
    "editedText" TEXT,
    "outcome" TEXT,
    "metaJson" TEXT,
    CONSTRAINT "outreach_learning_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_daily_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "targetGroup" TEXT NOT NULL,
    "genericInviteTail" TEXT NOT NULL,
    "generationBatchId" TEXT NOT NULL,
    CONSTRAINT "outreach_daily_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outreach_instagram_leads_deletedAt_status_createdAt_idx" ON "outreach_instagram_leads"("deletedAt", "status", "createdAt");
CREATE INDEX "outreach_instagram_leads_handle_idx" ON "outreach_instagram_leads"("handle");
CREATE INDEX "outreach_facebook_leads_deletedAt_status_createdAt_idx" ON "outreach_facebook_leads"("deletedAt", "status", "createdAt");
CREATE INDEX "outreach_facebook_leads_pageUrl_idx" ON "outreach_facebook_leads"("pageUrl");
CREATE INDEX "outreach_email_leads_deletedAt_status_createdAt_idx" ON "outreach_email_leads"("deletedAt", "status", "createdAt");
CREATE INDEX "outreach_email_leads_email_idx" ON "outreach_email_leads"("email");
CREATE INDEX "outreach_other_leads_deletedAt_status_createdAt_idx" ON "outreach_other_leads"("deletedAt", "status", "createdAt");
CREATE INDEX "outreach_learning_signals_platform_signalType_createdAt_idx" ON "outreach_learning_signals"("platform", "signalType", "createdAt");
CREATE INDEX "outreach_daily_templates_platform_targetGroup_createdAt_idx" ON "outreach_daily_templates"("platform", "targetGroup", "createdAt");
CREATE UNIQUE INDEX "outreach_daily_templates_generationBatchId_key" ON "outreach_daily_templates"("generationBatchId");
