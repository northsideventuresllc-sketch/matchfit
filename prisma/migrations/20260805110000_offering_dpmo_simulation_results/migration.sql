-- OFFERING DPMO SIMULATION RESULTS — ADDITIVE ONLY.
-- Wires the DPMO Simulation Engine (NI-Brain Decision #543, nv-vault/simulations)
-- into venture_offering_dpmo so content generation can read modeled outcomes
-- per offering: current phase-move status and the p10/median/p90 numbers.
-- Nothing dropped, nothing deleted, nothing renamed. Idempotent (IF NOT EXISTS).
-- Applied live 2026-08-05 via mcp__Supabase__apply_migration against
-- qtesdsxrfggdlxdaraaq — this file brings the repo migration history back in
-- sync with what is already live.

ALTER TABLE "venture_offering_dpmo"
  ADD COLUMN IF NOT EXISTS "simPhase1ConversionLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "simPhase1P10Conversions"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase1MedianConversions" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase1P90Conversions"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase1P10Revenue"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase1MedianRevenue"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase1P90Revenue"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase2RevenueLabel"    TEXT,
  ADD COLUMN IF NOT EXISTS "simPhase2P10Revenue"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase2MedianRevenue"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simPhase2P90Revenue"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "simRecommendPhaseMove"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "simRecommendReason"       TEXT,
  ADD COLUMN IF NOT EXISTS "simDataSource"            TEXT,
  ADD COLUMN IF NOT EXISTS "simRanAt"                 TIMESTAMP(3);

COMMENT ON COLUMN "venture_offering_dpmo"."simPhase1ConversionLabel" IS
  'What simPhase1*Conversions counts for this archetype: paid, orders, closed deals, or signups (waitlist).';
COMMENT ON COLUMN "venture_offering_dpmo"."simPhase2RevenueLabel" IS
  'What simPhase2*Revenue measures: mrr_month6 (recurring) or revenue_6mo (one-time/cumulative).';
COMMENT ON COLUMN "venture_offering_dpmo"."simRecommendPhaseMove" IS
  'DPMO Simulation Engine phase-move recommendation: real/modeled Phase-1 signal clears this archetype''s Phase-1 goal.';
COMMENT ON COLUMN "venture_offering_dpmo"."simDataSource" IS
  'Where the simulation numbers came from, e.g. [FIXTURE 2026-08-04] or [LIVE]. Never trust these numbers without checking this label is recent.';

-- View change is APPEND-ONLY: new columns go on the end, nothing existing moves.
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
  d."marketingProof",
  d."marketingChannels",
  d."marketingCadence",
  d."marketingNotes",
  d."outreachNotes",
  d."marketingLeadSource",
  d."outreachLeadSource",
  d."phaseSwitchTrigger",
  d."jbInvolvement",
  d."sectorReconciliation",
  d."offeringId",
  d."marketingEnabled",
  d."outreachEnabled",
  d."product_reach",
  d."marketing_markets",
  -- ── appended 2026-08-05: DPMO Simulation Engine results ──────────────────
  d."simPhase1ConversionLabel",
  d."simPhase1P10Conversions",
  d."simPhase1MedianConversions",
  d."simPhase1P90Conversions",
  d."simPhase1P10Revenue",
  d."simPhase1MedianRevenue",
  d."simPhase1P90Revenue",
  d."simPhase2RevenueLabel",
  d."simPhase2P10Revenue",
  d."simPhase2MedianRevenue",
  d."simPhase2P90Revenue",
  d."simRecommendPhaseMove",
  d."simRecommendReason",
  d."simDataSource",
  d."simRanAt"
FROM "venture_offering_dpmo" d
JOIN "venture_offerings" o           ON o."id" = d."offeringId"
JOIN "ventures" v                    ON v."id" = o."ventureId"
JOIN "venture_offering_categories" c ON c."id" = o."categoryId";
