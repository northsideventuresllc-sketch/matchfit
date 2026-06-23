-- FP multi-tier account system (feature/fp-account-tiers)

ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "externalWebsiteUrl" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "eliteDashboardViewMode" TEXT;

ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "accountTier" TEXT;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "tierSwitchedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "tierSwitchCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "pendingTier" TEXT;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "listingStatus" TEXT NOT NULL DEFAULT 'pending_docs';
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "listingPausedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "billingCycleEnd" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "gracePeriodEnd" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsRejectionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsLastRejectedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "backgroundCheckPassed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "promoteTokensBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "promoteTokensResetAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "public"."fp_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    CONSTRAINT "fp_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."tier_switch_history" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "fromTier" TEXT,
    "toTier" TEXT NOT NULL,
    "switchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedBy" TEXT NOT NULL DEFAULT 'trainer',
    CONSTRAINT "tier_switch_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."fp_listing_stats" (
    "trainerId" TEXT NOT NULL,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "clickThroughs" INTEGER NOT NULL DEFAULT 0,
    "reviewCountInternal" INTEGER NOT NULL DEFAULT 0,
    "reviewCountExternal" INTEGER NOT NULL DEFAULT 0,
    "memberSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeListingsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fp_listing_stats_pkey" PRIMARY KEY ("trainerId")
);

CREATE TABLE IF NOT EXISTS "public"."featured_listings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT NOT NULL,
    "regionTier" TEXT NOT NULL,
    "zipCodes" TEXT[],
    "metroArea" TEXT,
    "state" TEXT,
    "bidAmount" INTEGER NOT NULL,
    "bidStart" TIMESTAMP(3) NOT NULL,
    "bidEnd" TIMESTAMP(3) NOT NULL,
    "slotPosition" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "featured_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."promote_token_ledger" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceId" TEXT,
    CONSTRAINT "promote_token_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."support_groups" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByFpId" TEXT NOT NULL,
    "groupType" TEXT NOT NULL DEFAULT 'public',
    "tierRequired" TEXT NOT NULL DEFAULT 'any',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "support_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."support_group_members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_group_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."fp_ad_integrations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "integrationStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "adAccountId" TEXT,
    "connectedAt" TIMESTAMP(3),
    CONSTRAINT "fp_ad_integrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fp_documents_trainerId_docType_idx" ON "public"."fp_documents"("trainerId", "docType");
CREATE INDEX IF NOT EXISTS "fp_documents_trainerId_status_idx" ON "public"."fp_documents"("trainerId", "status");
CREATE INDEX IF NOT EXISTS "tier_switch_history_trainerId_switchedAt_idx" ON "public"."tier_switch_history"("trainerId", "switchedAt");
CREATE INDEX IF NOT EXISTS "featured_listings_regionTier_isActive_bidEnd_idx" ON "public"."featured_listings"("regionTier", "isActive", "bidEnd");
CREATE INDEX IF NOT EXISTS "featured_listings_trainerId_bidEnd_idx" ON "public"."featured_listings"("trainerId", "bidEnd");
CREATE INDEX IF NOT EXISTS "promote_token_ledger_trainerId_createdAt_idx" ON "public"."promote_token_ledger"("trainerId", "createdAt");
CREATE INDEX IF NOT EXISTS "support_groups_createdByFpId_idx" ON "public"."support_groups"("createdByFpId");
CREATE UNIQUE INDEX IF NOT EXISTS "support_group_members_groupId_userId_key" ON "public"."support_group_members"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "support_group_members_userId_idx" ON "public"."support_group_members"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "fp_ad_integrations_trainerId_platform_key" ON "public"."fp_ad_integrations"("trainerId", "platform");

ALTER TABLE "public"."fp_documents" DROP CONSTRAINT IF EXISTS "fp_documents_trainerId_fkey";
ALTER TABLE "public"."fp_documents" ADD CONSTRAINT "fp_documents_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."tier_switch_history" DROP CONSTRAINT IF EXISTS "tier_switch_history_trainerId_fkey";
ALTER TABLE "public"."tier_switch_history" ADD CONSTRAINT "tier_switch_history_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."fp_listing_stats" DROP CONSTRAINT IF EXISTS "fp_listing_stats_trainerId_fkey";
ALTER TABLE "public"."fp_listing_stats" ADD CONSTRAINT "fp_listing_stats_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."featured_listings" DROP CONSTRAINT IF EXISTS "featured_listings_trainerId_fkey";
ALTER TABLE "public"."featured_listings" ADD CONSTRAINT "featured_listings_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."promote_token_ledger" DROP CONSTRAINT IF EXISTS "promote_token_ledger_trainerId_fkey";
ALTER TABLE "public"."promote_token_ledger" ADD CONSTRAINT "promote_token_ledger_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."support_groups" DROP CONSTRAINT IF EXISTS "support_groups_createdByFpId_fkey";
ALTER TABLE "public"."support_groups" ADD CONSTRAINT "support_groups_createdByFpId_fkey" FOREIGN KEY ("createdByFpId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."support_group_members" DROP CONSTRAINT IF EXISTS "support_group_members_groupId_fkey";
ALTER TABLE "public"."support_group_members" ADD CONSTRAINT "support_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."support_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."fp_ad_integrations" DROP CONSTRAINT IF EXISTS "fp_ad_integrations_trainerId_fkey";
ALTER TABLE "public"."fp_ad_integrations" ADD CONSTRAINT "fp_ad_integrations_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
