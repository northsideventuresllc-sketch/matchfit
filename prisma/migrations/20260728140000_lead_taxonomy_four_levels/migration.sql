-- LEAD TAXONOMY — four levels, generic first.
-- JB LOCKED: NI-Brain Decision #388 (structure) + #389 (DPMO push flexibility).
--
--   1. Venture  ->  2. Offering category  ->  3. Offering  ->  4. Audience
--
-- Reference tables + foreign keys. NOT enums, NOT free-text columns.
-- ADDING A NEW VENTURE IS AN INSERT, NEVER A MIGRATION AND NEVER A CODE CHANGE.
--
-- ADDITIVE AND NON-DESTRUCTIVE. No column is dropped, no row is deleted, no data
-- is lost. `targetGroup` (the dead ATL_LOCAL / VIRTUAL geo tagging, Decision #342)
-- is deliberately LEFT ALONE for history. The new FKs are the source of truth.
-- Existing rows keep working with NULL FKs.
--
-- Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING), matching the self-healing
-- DDL style in src/lib/ensure-outreach-hub-schema.ts.

-- ---------------------------------------------------------------------------
-- 1. Reference tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ventures" (
  "id"             TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "slug"           TEXT NOT NULL,
  "displayName"    TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  -- Geography is PER VENTURE, never a global rule (Decision #342). Free text so a
  -- new venture with a different geography needs no migration.
  "geographyScope" TEXT NOT NULL DEFAULT 'nationwide',
  "geographyNote"  TEXT,
  CONSTRAINT "ventures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ventures_slug_key" ON "ventures" ("slug");
CREATE INDEX IF NOT EXISTS "ventures_isActive_sortOrder_idx" ON "ventures" ("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "venture_offering_categories" (
  "id"          TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "ventureId"   TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "venture_offering_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "venture_offering_categories_ventureId_slug_key"
  ON "venture_offering_categories" ("ventureId", "slug");
CREATE INDEX IF NOT EXISTS "venture_offering_categories_ventureId_isActive_sortOrder_idx"
  ON "venture_offering_categories" ("ventureId", "isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "venture_offerings" (
  "id"          TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "ventureId"   TEXT NOT NULL,
  "categoryId"  TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "summary"     TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  -- DPMO PUSH FLEXIBILITY (Decision #389): TWO INDEPENDENT SWITCHES.
  -- outreach-only / marketing-only / both / neither. NEVER hard-wired together.
  "pushableByOutreach"  BOOLEAN NOT NULL DEFAULT false,
  "pushableByMarketing" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "venture_offerings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "venture_offerings_ventureId_slug_key"
  ON "venture_offerings" ("ventureId", "slug");
CREATE INDEX IF NOT EXISTS "venture_offerings_categoryId_isActive_sortOrder_idx"
  ON "venture_offerings" ("categoryId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "venture_offerings_ventureId_pushableByOutreach_idx"
  ON "venture_offerings" ("ventureId", "pushableByOutreach");
CREATE INDEX IF NOT EXISTS "venture_offerings_ventureId_pushableByMarketing_idx"
  ON "venture_offerings" ("ventureId", "pushableByMarketing");

CREATE TABLE IF NOT EXISTS "venture_audiences" (
  "id"          TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "ventureId"   TEXT NOT NULL,
  -- Match Fit audiences are ACCOUNT TIERS (FP / IP / EP). Never geography.
  "code"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "venture_audiences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "venture_audiences_ventureId_code_key"
  ON "venture_audiences" ("ventureId", "code");
CREATE INDEX IF NOT EXISTS "venture_audiences_ventureId_isActive_sortOrder_idx"
  ON "venture_audiences" ("ventureId", "isActive", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "venture_offering_categories"
    ADD CONSTRAINT "venture_offering_categories_ventureId_fkey"
    FOREIGN KEY ("ventureId") REFERENCES "ventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "venture_offerings"
    ADD CONSTRAINT "venture_offerings_ventureId_fkey"
    FOREIGN KEY ("ventureId") REFERENCES "ventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "venture_offerings"
    ADD CONSTRAINT "venture_offerings_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "venture_offering_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "venture_audiences"
    ADD CONSTRAINT "venture_audiences_ventureId_fkey"
    FOREIGN KEY ("ventureId") REFERENCES "ventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Lead tables gain NULLABLE taxonomy FKs. Nothing is dropped or rewritten.
--    Level 2 (category) is reached THROUGH the offering, so it cannot drift.
-- ---------------------------------------------------------------------------

ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "ventureId"  TEXT,
  ADD COLUMN IF NOT EXISTS "offeringId" TEXT,
  ADD COLUMN IF NOT EXISTS "audienceId" TEXT;

ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "ventureId"  TEXT,
  ADD COLUMN IF NOT EXISTS "offeringId" TEXT,
  ADD COLUMN IF NOT EXISTS "audienceId" TEXT;

ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "ventureId"  TEXT,
  ADD COLUMN IF NOT EXISTS "offeringId" TEXT,
  ADD COLUMN IF NOT EXISTS "audienceId" TEXT;

ALTER TABLE "outreach_other_leads"
  ADD COLUMN IF NOT EXISTS "ventureId"  TEXT,
  ADD COLUMN IF NOT EXISTS "offeringId" TEXT,
  ADD COLUMN IF NOT EXISTS "audienceId" TEXT;

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_ventureId_idx"  ON "outreach_instagram_leads" ("ventureId");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_offeringId_idx" ON "outreach_instagram_leads" ("offeringId");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_audienceId_idx" ON "outreach_instagram_leads" ("audienceId");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_ventureId_idx"   ON "outreach_facebook_leads" ("ventureId");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_offeringId_idx"  ON "outreach_facebook_leads" ("offeringId");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_audienceId_idx"  ON "outreach_facebook_leads" ("audienceId");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_ventureId_idx"      ON "outreach_email_leads" ("ventureId");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_offeringId_idx"     ON "outreach_email_leads" ("offeringId");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_audienceId_idx"     ON "outreach_email_leads" ("audienceId");
CREATE INDEX IF NOT EXISTS "outreach_other_leads_ventureId_idx"      ON "outreach_other_leads" ("ventureId");
CREATE INDEX IF NOT EXISTS "outreach_other_leads_offeringId_idx"     ON "outreach_other_leads" ("offeringId");
CREATE INDEX IF NOT EXISTS "outreach_other_leads_audienceId_idx"     ON "outreach_other_leads" ("audienceId");

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'outreach_instagram_leads','outreach_facebook_leads','outreach_email_leads','outreach_other_leads'
  ] LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("ventureId") REFERENCES "ventures"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_ventureId_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("offeringId") REFERENCES "venture_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_offeringId_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("audienceId") REFERENCES "venture_audiences"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_audienceId_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Populate the current ventures. THIS IS DATA, NOT STRUCTURE.
--    A new venture is added by inserting here-shaped rows. Nothing above changes.
--    Kept in lockstep with src/lib/lead-taxonomy.ts (LEAD_TAXONOMY_SEED); the
--    test src/__tests__/lead-taxonomy.test.ts fails if the two drift apart.
--    Match Fit offerings/audiences: verified in this repo (fp-account-tier-types.ts,
--    outreachIntent). NI offerings: verified on the live NI portal, 2026-07-28.
--    NO PRICES ARE STORED HERE — pricing lives on the portal, not in the taxonomy.
-- ---------------------------------------------------------------------------

INSERT INTO "ventures" ("id","createdAt","updatedAt","slug","displayName","isActive","sortOrder","geographyScope","geographyNote") VALUES
  ('ven_match_fit', NOW(), NOW(), 'match_fit', 'Match Fit', true, 1, 'nationwide', 'Online / virtual coaches, nationwide. No city, no region, no map.'),
  ('ven_ni_services', NOW(), NOW(), 'ni_services', 'NI Services', true, 2, 'nationwide', 'Sold online. B2B and B2C, not limited by industry.')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "venture_offering_categories" ("id","createdAt","updatedAt","ventureId","slug","displayName","description","isActive","sortOrder") VALUES
  ('voc_match_fit__fitness_pro_membership', NOW(), NOW(), 'ven_match_fit', 'fitness_pro_membership', 'Fitness Pro Membership', 'What a coach joins Match Fit as.', true, 1),
  ('voc_match_fit__client_membership', NOW(), NOW(), 'ven_match_fit', 'client_membership', 'Client Membership', 'What a client joins Match Fit as.', true, 2),
  ('voc_ni_services__intelligence_tools', NOW(), NOW(), 'ven_ni_services', 'intelligence_tools', 'Intelligence Tools', 'Self-serve tools on the NI portal.', true, 1),
  ('voc_ni_services__intelligence_services', NOW(), NOW(), 'ven_ni_services', 'intelligence_services', 'Intelligence Services', 'Done-for-you projects, quoted individually.', true, 2),
  ('voc_ni_services__subscription_plans', NOW(), NOW(), 'ven_ni_services', 'subscription_plans', 'Subscription Plans', 'Portal-wide plans covering the tools.', true, 3),
  ('voc_ni_services__smart_store', NOW(), NOW(), 'ven_ni_services', 'smart_store', 'Smart Store', 'Daily curated product marketplace.', true, 4)
ON CONFLICT ("ventureId", "slug") DO NOTHING;

INSERT INTO "venture_offerings" ("id","createdAt","updatedAt","ventureId","categoryId","slug","displayName","summary","isActive","sortOrder","pushableByOutreach","pushableByMarketing") VALUES
  ('vof_match_fit__premium_hub_access', NOW(), NOW(), 'ven_match_fit', 'voc_match_fit__fitness_pro_membership', 'premium_hub_access', 'Premium Hub Access', 'Premium access for a Fitness Pro.', true, 1, true, true),
  ('vof_match_fit__directory_listing', NOW(), NOW(), 'ven_match_fit', 'voc_match_fit__fitness_pro_membership', 'directory_listing', 'Directory Listing', 'Listing access for an Independent Pro.', true, 2, true, true),
  ('vof_match_fit__elite_full_access', NOW(), NOW(), 'ven_match_fit', 'voc_match_fit__fitness_pro_membership', 'elite_full_access', 'Elite Full Access', 'Premium access and listing access together.', true, 3, true, true),
  ('vof_match_fit__client_vip', NOW(), NOW(), 'ven_match_fit', 'voc_match_fit__client_membership', 'client_vip', 'Client VIP', 'Paid client membership.', true, 1, false, true),
  ('vof_ni_services__replyflow', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_tools', 'replyflow', 'ReplyFlow', NULL, true, 1, true, true),
  ('vof_ni_services__grantbot', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_tools', 'grantbot', 'GrantBot', NULL, true, 2, false, true),
  ('vof_ni_services__signaldesk', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_tools', 'signaldesk', 'Signal Desk', NULL, true, 3, false, true),
  ('vof_ni_services__gapscan', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_tools', 'gapscan', 'GapScan', NULL, true, 4, false, true),
  ('vof_ni_services__bridgeai', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_tools', 'bridgeai', 'BridgeAI', NULL, true, 5, false, true),
  ('vof_ni_services__custom_web_design_and_management', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'custom_web_design_and_management', 'Custom Web Design and Management', NULL, true, 1, true, true),
  ('vof_ni_services__executive_briefing_intelligence', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'executive_briefing_intelligence', 'Executive Briefing Intelligence', NULL, true, 2, true, true),
  ('vof_ni_services__ai_research_assistant_setup', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'ai_research_assistant_setup', 'AI Research Assistant Setup', NULL, true, 3, true, true),
  ('vof_ni_services__personal_intelligence_setup', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'personal_intelligence_setup', 'Personal Intelligence Setup', NULL, true, 4, true, true),
  ('vof_ni_services__personal_knowledge_base_build', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'personal_knowledge_base_build', 'Personal Knowledge Base Build', NULL, true, 5, true, true),
  ('vof_ni_services__intelligence_audit_and_gap_analysis', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'intelligence_audit_and_gap_analysis', 'Intelligence Audit & Gap Analysis', NULL, true, 6, true, true),
  ('vof_ni_services__tailored_intelligence_server', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'tailored_intelligence_server', 'Tailored Intelligence Server', NULL, true, 7, true, true),
  ('vof_ni_services__team_intelligence_training_and_onboarding', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'team_intelligence_training_and_onboarding', 'Team Intelligence Training & Onboarding', NULL, true, 8, true, true),
  ('vof_ni_services__workflow_integration_and_automation', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'workflow_integration_and_automation', 'Workflow Integration & Automation', NULL, true, 9, true, true),
  ('vof_ni_services__ai_governance_and_compliance_framework', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'ai_governance_and_compliance_framework', 'AI Governance & Compliance Framework', NULL, true, 10, true, true),
  ('vof_ni_services__enterprise_ai_strategy', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__intelligence_services', 'enterprise_ai_strategy', 'Enterprise AI Strategy', NULL, true, 11, true, true),
  ('vof_ni_services__plan_free', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__subscription_plans', 'plan_free', 'Free Plan', NULL, true, 1, false, true),
  ('vof_ni_services__plan_core', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__subscription_plans', 'plan_core', 'Core Plan', NULL, true, 2, false, true),
  ('vof_ni_services__plan_pro', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__subscription_plans', 'plan_pro', 'Pro Plan', NULL, true, 3, false, true),
  ('vof_ni_services__plan_power', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__subscription_plans', 'plan_power', 'Power Plan', NULL, true, 4, false, true),
  ('vof_ni_services__smart_store', NOW(), NOW(), 'ven_ni_services', 'voc_ni_services__smart_store', 'smart_store', 'Smart Store', NULL, true, 1, false, true)
ON CONFLICT ("ventureId", "slug") DO NOTHING;

INSERT INTO "venture_audiences" ("id","createdAt","updatedAt","ventureId","code","displayName","description","isActive","sortOrder") VALUES
  ('vau_match_fit__fp', NOW(), NOW(), 'ven_match_fit', 'FP', 'Fitness Pro', 'Premium access.', true, 1),
  ('vau_match_fit__ip', NOW(), NOW(), 'ven_match_fit', 'IP', 'Independent Pro', 'Listing access.', true, 2),
  ('vau_match_fit__ep', NOW(), NOW(), 'ven_match_fit', 'EP', 'Elite Pro', 'Premium access and listing access.', true, 3),
  ('vau_ni_services__b2c', NOW(), NOW(), 'ven_ni_services', 'B2C', 'Individuals', 'A person buying for themselves.', true, 1),
  ('vau_ni_services__b2b', NOW(), NOW(), 'ven_ni_services', 'B2B', 'Businesses', 'Any company, any industry.', true, 2),
  ('vau_ni_services__ent', NOW(), NOW(), 'ven_ni_services', 'ENT', 'Enterprise', 'Large organisations.', true, 3)
ON CONFLICT ("ventureId", "code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Backfill existing rows. Non-destructive: only NULL FKs are filled.
--    Every outreach lead in this database belongs to Match Fit (this is the
--    Match Fit app). `outreachIntent` is the ONLY existing column carrying real
--    audience meaning and it maps exactly onto JB's tiers. The dead `targetGroup`
--    geo values map onto nothing and are deliberately ignored — rows without an
--    intent keep NULL offering/audience and are re-filed going forward.
--      LIST_WITH_US -> Independent Pro (IP) / Directory Listing
--      JOIN_AS_FP   -> Fitness Pro (FP)    / Premium Hub Access
--      BOTH         -> Elite Pro (EP)      / Elite Full Access
-- ---------------------------------------------------------------------------

UPDATE "outreach_instagram_leads" SET "ventureId" = 'ven_match_fit' WHERE "ventureId" IS NULL;
UPDATE "outreach_facebook_leads"  SET "ventureId" = 'ven_match_fit' WHERE "ventureId" IS NULL;
UPDATE "outreach_email_leads"     SET "ventureId" = 'ven_match_fit' WHERE "ventureId" IS NULL;
UPDATE "outreach_other_leads"     SET "ventureId" = 'ven_match_fit' WHERE "ventureId" IS NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'outreach_instagram_leads','outreach_facebook_leads','outreach_email_leads'
  ] LOOP
    EXECUTE format($f$
      UPDATE %I SET
        "audienceId" = CASE upper(trim("outreachIntent"))
          WHEN 'LIST_WITH_US' THEN 'vau_match_fit__ip'
          WHEN 'JOIN_AS_FP'   THEN 'vau_match_fit__fp'
          WHEN 'BOTH'         THEN 'vau_match_fit__ep'
        END,
        "offeringId" = CASE upper(trim("outreachIntent"))
          WHEN 'LIST_WITH_US' THEN 'vof_match_fit__directory_listing'
          WHEN 'JOIN_AS_FP'   THEN 'vof_match_fit__premium_hub_access'
          WHEN 'BOTH'         THEN 'vof_match_fit__elite_full_access'
        END
      WHERE "audienceId" IS NULL
        AND "offeringId" IS NULL
        AND "outreachIntent" IS NOT NULL
        AND upper(trim("outreachIntent")) IN ('LIST_WITH_US','JOIN_AS_FP','BOTH')
    $f$, t);
  END LOOP;
END $$;
