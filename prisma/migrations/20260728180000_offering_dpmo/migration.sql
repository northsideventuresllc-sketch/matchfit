-- OFFERING DPMO — Dual-Phase Marketing & Outreach, one record per offering.
-- JB LOCKED (2026-07-28). DPMO = Dual-Phase Marketing & Outreach.
--   Phase 1 = first revenue. Phase 2 = retain and scale.
--
-- TWO ADAPTABLE SKELETONS PER OFFERING:
--   MARKETING skeleton = social content + ads.
--   OUTREACH  skeleton = a DM or an email to a person.
-- Stored as separate column groups. One is never derived from the other.
--
-- THE TWO LIVE SWITCHES — `marketingEnabled` and `outreachEnabled`.
--   BOTH DEFAULT FALSE. Independent. Neither ever implies the other.
--   Effective push = venture_offerings.pushableBy* (eligibility, sector shape)
--                    AND venture_offering_dpmo.*Enabled (JB's live switch).
--
-- ADDITIVE AND NON-DESTRUCTIVE. Nothing is dropped, nothing is deleted.
-- Idempotent (IF NOT EXISTS), matching the house self-healing DDL style.

CREATE TABLE IF NOT EXISTS "venture_offering_dpmo" (
  "id"         TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "offeringId" TEXT NOT NULL,

  -- Free text: `1A`, `1B`, `2`, `3`, `4`, `5`, `services`, or a sector that
  -- does not exist yet. A new sector is data, never a migration.
  "sector"     TEXT NOT NULL,
  -- `phase_0` (audience building), `phase_1` (first revenue), `phase_2` (retain and scale).
  "phase"      TEXT NOT NULL DEFAULT 'phase_1',

  -- ── THE TWO LIVE SWITCHES. BOTH DEFAULT FALSE. ────────────────────────────
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "outreachEnabled"  BOOLEAN NOT NULL DEFAULT false,

  -- ── MARKETING SKELETON (social content + ads) ─────────────────────────────
  "marketingAngle"    TEXT,
  "marketingProof"    TEXT,
  "marketingCta"      TEXT,
  "marketingLink"     TEXT,
  "marketingChannels" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "marketingCadence"  TEXT,
  "marketingNotes"    TEXT,

  -- ── OUTREACH SKELETON (a DM or an email to a person) ──────────────────────
  -- Foundation rule: 1 personal line + 1 benefit + 1 link. No question. No call.
  "outreachChannel" TEXT NOT NULL DEFAULT 'none',
  "outreachOpener"  TEXT,
  "outreachBenefit" TEXT,
  "outreachLink"    TEXT,
  "outreachNotes"   TEXT,

  -- ── Shared ────────────────────────────────────────────────────────────────
  "benefitLine" TEXT,
  -- Price EXACTLY as the live portal shows it, with the date it was read.
  -- Never written from memory.
  "priceNote"   TEXT,

  CONSTRAINT "venture_offering_dpmo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "venture_offering_dpmo_offeringId_key"
  ON "venture_offering_dpmo" ("offeringId");
CREATE INDEX IF NOT EXISTS "venture_offering_dpmo_sector_idx"
  ON "venture_offering_dpmo" ("sector");
CREATE INDEX IF NOT EXISTS "venture_offering_dpmo_marketingEnabled_idx"
  ON "venture_offering_dpmo" ("marketingEnabled");
CREATE INDEX IF NOT EXISTS "venture_offering_dpmo_outreachEnabled_idx"
  ON "venture_offering_dpmo" ("outreachEnabled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venture_offering_dpmo_offeringId_fkey'
  ) THEN
    ALTER TABLE "venture_offering_dpmo"
      ADD CONSTRAINT "venture_offering_dpmo_offeringId_fkey"
      FOREIGN KEY ("offeringId") REFERENCES "venture_offerings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Plain-English read surface. No raw values, no slugs, no codes on JB's screens.
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
  d."outreachLink"
FROM "venture_offering_dpmo" d
JOIN "venture_offerings" o           ON o."id" = d."offeringId"
JOIN "ventures" v                    ON v."id" = o."ventureId"
JOIN "venture_offering_categories" c ON c."id" = o."categoryId";
