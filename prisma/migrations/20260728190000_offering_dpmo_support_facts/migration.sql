-- OFFERING DPMO — the remaining support facts. ADDITIVE ONLY.
--
-- Every skeleton must record six things. Three already existed on the table:
--   phase, channels (marketingChannels / outreachChannel), and the CTA.
-- These are the other three:
--   LEAD SOURCE            — stored SEPARATELY per skeleton. Marketing and
--                            outreach are different objects and must never
--                            share a lead source.
--   PHASE 1 -> 2 TRIGGER   — the observable event that flips the phase.
--                            Data-triggered, never a date.
--   JB'S INVOLVEMENT LEVEL — more autonomous = more automated = less JB.
--
-- Plus `sectorReconciliation`, set ONLY where live reality contradicts the
-- 6-Sector Master doc, so a stale row is superseded explicitly and in the open
-- rather than quietly overwritten.
--
-- Nothing is dropped, nothing is deleted, nothing sends.

ALTER TABLE "venture_offering_dpmo"
  ADD COLUMN IF NOT EXISTS "marketingLeadSource" TEXT,
  ADD COLUMN IF NOT EXISTS "outreachLeadSource"  TEXT,
  ADD COLUMN IF NOT EXISTS "phaseSwitchTrigger"  TEXT,
  ADD COLUMN IF NOT EXISTS "jbInvolvement"       TEXT,
  ADD COLUMN IF NOT EXISTS "sectorReconciliation" TEXT;

COMMENT ON COLUMN "venture_offering_dpmo"."marketingLeadSource" IS
  'Where the MARKETING skeleton gets attention from. Never blended with outreach.';
COMMENT ON COLUMN "venture_offering_dpmo"."outreachLeadSource" IS
  'Where the OUTREACH skeleton gets people from. Never blended with marketing.';
COMMENT ON COLUMN "venture_offering_dpmo"."phaseSwitchTrigger" IS
  'The observable event that flips Phase 1 -> Phase 2. Data-triggered, never a date.';
COMMENT ON COLUMN "venture_offering_dpmo"."jbInvolvement" IS
  'How much JB touches this offering. More autonomous = more automated = less JB.';
COMMENT ON COLUMN "venture_offering_dpmo"."sectorReconciliation" IS
  'Supersede note where live reality contradicts the 6-Sector Master doc.';

-- View change is APPEND-ONLY: the new columns go on the end so no existing
-- column is renamed or reordered (CREATE OR REPLACE VIEW forbids that anyway).
CREATE OR REPLACE VIEW "v_offering_dpmo" AS
SELECT
  v."displayName"  AS venture,
  c."displayName"  AS category,
  o."displayName"  AS offering,
  d."sector"       AS sector,
  CASE d."phase"
    WHEN 'phase_0' THEN 'Audience building — no offer yet'
    WHEN 'phase_1' THEN 'Phase 1 — first revenue'
    WHEN 'phase_2' THEN 'Phase 2 — retain and scale'
    ELSE d."phase"
  END AS phase,
  CASE
    WHEN o."isActive" AND o."pushableByOutreach"  AND d."outreachEnabled"
     AND o."pushableByMarketing" AND d."marketingEnabled" THEN 'Being pushed by outreach and marketing'
    WHEN o."isActive" AND o."pushableByOutreach"  AND d."outreachEnabled"  THEN 'Being pushed by outreach only'
    WHEN o."isActive" AND o."pushableByMarketing" AND d."marketingEnabled" THEN 'Being pushed by marketing only'
    ELSE 'Not being pushed'
  END AS push_status,
  o."pushableByMarketing" AS marketing_allowed,
  d."marketingEnabled"    AS marketing_switch_on,
  o."pushableByOutreach"  AS outreach_allowed,
  d."outreachEnabled"     AS outreach_switch_on,
  d."outreachChannel",
  d."benefitLine",
  d."priceNote",
  d."marketingAngle",
  d."marketingCta",
  d."marketingLink",
  d."outreachOpener",
  d."outreachBenefit",
  d."outreachLink",
  -- ── appended 2026-07-28 ──────────────────────────────────────────────────
  d."marketingProof",
  d."marketingChannels",
  d."marketingCadence",
  d."marketingNotes",
  d."outreachNotes",
  d."marketingLeadSource",
  d."outreachLeadSource",
  d."phaseSwitchTrigger",
  d."jbInvolvement",
  d."sectorReconciliation"
FROM "venture_offering_dpmo" d
JOIN "venture_offerings" o           ON o."id" = d."offeringId"
JOIN "ventures" v                    ON v."id" = o."ventureId"
JOIN "venture_offering_categories" c ON c."id" = o."categoryId";
