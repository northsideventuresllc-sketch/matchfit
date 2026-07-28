import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEAD_LEGACY_TARGET_GROUPS,
  LEAD_TAXONOMY_PUSH_MODE_LABELS,
  LEAD_TAXONOMY_SEED,
  MATCH_FIT_VENTURE_SLUG,
  NI_SERVICES_VENTURE_SLUG,
  leadTaxonomyPushMode,
  matchFitTaxonomyForLegacyLead,
  offeringsPushableByMarketing,
  offeringsPushableByOutreach,
  resolveLeadTaxonomyPath,
  seedAudiencesForVenture,
  seedOfferingsForVenture,
  validateLeadTaxonomyDefinition,
  type LeadTaxonomyDefinition,
} from "@/lib/lead-taxonomy";

const MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20260728140000_lead_taxonomy_four_levels/migration.sql"),
  "utf8",
);

const SCHEMA_PRISMA = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

const LEAD_TABLES = [
  "outreach_instagram_leads",
  "outreach_facebook_leads",
  "outreach_email_leads",
  "outreach_other_leads",
] as const;

describe("lead taxonomy — generic structure", () => {
  it("models four levels and reaches the category through the offering, never on the lead", () => {
    // Level 2 must NOT be a column on a lead table — that is how the path drifts.
    expect(MIGRATION_SQL).not.toMatch(/outreach_\w+_leads[\s\S]{0,400}?ADD COLUMN IF NOT EXISTS "categoryId"/);
    for (const table of LEAD_TABLES) {
      const alter = MIGRATION_SQL.slice(MIGRATION_SQL.indexOf(`ALTER TABLE "${table}"`));
      expect(alter).toContain('ADD COLUMN IF NOT EXISTS "ventureId"');
      expect(alter).toContain('ADD COLUMN IF NOT EXISTS "offeringId"');
      expect(alter).toContain('ADD COLUMN IF NOT EXISTS "audienceId"');
    }
    // The offering carries the category FK, so there is exactly one path to level 2.
    expect(MIGRATION_SQL).toContain('"venture_offerings_categoryId_fkey"');
  });

  it("stores the taxonomy as reference tables, not as an enum or a free-text column", () => {
    for (const table of ["ventures", "venture_offering_categories", "venture_offerings", "venture_audiences"]) {
      expect(MIGRATION_SQL).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    // A Postgres enum would force a migration for every new venture. There must be none.
    expect(MIGRATION_SQL).not.toMatch(/CREATE TYPE .*AS ENUM/i);
    // Prisma must not model these as enums either.
    expect(SCHEMA_PRISMA).not.toMatch(/enum\s+Venture\w*\s*\{/);
  });

  it("keeps geography per venture and never bakes it into the schema", () => {
    expect(MIGRATION_SQL).toContain('"geographyScope" TEXT NOT NULL DEFAULT \'nationwide\'');
    // No venture name and no place name may appear as a column or a constraint.
    expect(MIGRATION_SQL).not.toMatch(/ADD COLUMN[^\n]*(atlanta|city|latitude|longitude)/i);
    const matchFit = LEAD_TAXONOMY_SEED.ventures.find((v) => v.slug === MATCH_FIT_VENTURE_SLUG);
    expect(matchFit?.geographyScope).toBe("nationwide");
  });

  it("adds a brand-new venture with data alone — no schema change, no code change", () => {
    // A venture that does not exist anywhere in this repo, with its own categories,
    // offerings and audiences, and a geography that differs from every current one.
    const withNewVenture: LeadTaxonomyDefinition = {
      ventures: [
        ...LEAD_TAXONOMY_SEED.ventures,
        {
          slug: "brand_new_venture",
          displayName: "Brand New Venture",
          isActive: true,
          sortOrder: 3,
          geographyScope: "global",
          geographyNote: "Different geography from every existing venture.",
        },
      ],
      categories: [
        ...LEAD_TAXONOMY_SEED.categories,
        {
          ventureSlug: "brand_new_venture",
          slug: "brand_new_category",
          displayName: "Brand New Category",
          description: null,
          isActive: true,
          sortOrder: 1,
        },
      ],
      offerings: [
        ...LEAD_TAXONOMY_SEED.offerings,
        {
          ventureSlug: "brand_new_venture",
          categorySlug: "brand_new_category",
          slug: "brand_new_offering",
          displayName: "Brand New Offering",
          summary: null,
          isActive: true,
          sortOrder: 1,
          pushableByOutreach: true,
          pushableByMarketing: false,
        },
      ],
      audiences: [
        ...LEAD_TAXONOMY_SEED.audiences,
        {
          ventureSlug: "brand_new_venture",
          code: "XX",
          displayName: "Brand New Audience",
          description: null,
          isActive: true,
          sortOrder: 1,
        },
      ],
    };

    expect(validateLeadTaxonomyDefinition(withNewVenture)).toEqual([]);

    // And a lead on that venture resolves its four levels with the same resolver —
    // no branch, no special case, nothing keyed on a venture name.
    const path = resolveLeadTaxonomyPath({
      venture: { slug: "brand_new_venture", displayName: "Brand New Venture" },
      offering: {
        slug: "brand_new_offering",
        displayName: "Brand New Offering",
        category: { slug: "brand_new_category", displayName: "Brand New Category" },
      },
      taxonomyAudience: { code: "XX", displayName: "Brand New Audience" },
    });
    expect(path.isComplete).toBe(true);
    expect(path.label).toBe("Brand New Venture › Brand New Category › Brand New Offering › Brand New Audience");
  });

  it("rejects a definition that points at a venture or category that does not exist", () => {
    const broken: LeadTaxonomyDefinition = {
      ventures: [],
      categories: [
        {
          ventureSlug: "missing_venture",
          slug: "c",
          displayName: "C",
          description: null,
          isActive: true,
          sortOrder: 1,
        },
      ],
      offerings: [
        {
          ventureSlug: "missing_venture",
          categorySlug: "missing_category",
          slug: "o",
          displayName: "O",
          summary: null,
          isActive: true,
          sortOrder: 1,
          pushableByOutreach: false,
          pushableByMarketing: false,
        },
      ],
      audiences: [
        {
          ventureSlug: "missing_venture",
          code: "A",
          displayName: "A",
          description: null,
          isActive: true,
          sortOrder: 1,
        },
      ],
    };
    const problems = validateLeadTaxonomyDefinition(broken);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).toContain("missing_venture");
    expect(problems.join(" ")).toContain("missing_category");
  });
});

describe("lead taxonomy — DPMO push flexibility (JB locked)", () => {
  it("keeps the two switches independent: outreach-only, marketing-only, both, neither", () => {
    expect(leadTaxonomyPushMode({ pushableByOutreach: true, pushableByMarketing: false })).toBe("outreach_only");
    expect(leadTaxonomyPushMode({ pushableByOutreach: false, pushableByMarketing: true })).toBe("marketing_only");
    expect(leadTaxonomyPushMode({ pushableByOutreach: true, pushableByMarketing: true })).toBe("both");
    expect(leadTaxonomyPushMode({ pushableByOutreach: false, pushableByMarketing: false })).toBe("not_pushed");
  });

  it("never lets one switch imply the other", () => {
    const outreachOnly = { pushableByOutreach: true, pushableByMarketing: false, isActive: true };
    const marketingOnly = { pushableByOutreach: false, pushableByMarketing: true, isActive: true };

    expect(offeringsPushableByOutreach([outreachOnly, marketingOnly])).toEqual([outreachOnly]);
    expect(offeringsPushableByMarketing([outreachOnly, marketingOnly])).toEqual([marketingOnly]);
  });

  it("stores the two switches as two separate columns, both defaulting to off", () => {
    expect(MIGRATION_SQL).toContain('"pushableByOutreach"  BOOLEAN NOT NULL DEFAULT false');
    expect(MIGRATION_SQL).toContain('"pushableByMarketing" BOOLEAN NOT NULL DEFAULT false');
  });

  it("excludes an inactive offering from both push lists", () => {
    const parked = { pushableByOutreach: true, pushableByMarketing: true, isActive: false };
    expect(offeringsPushableByOutreach([parked])).toEqual([]);
    expect(offeringsPushableByMarketing([parked])).toEqual([]);
  });

  it("labels every push mode in plain English, with no raw values", () => {
    for (const label of Object.values(LEAD_TAXONOMY_PUSH_MODE_LABELS)) {
      expect(label).not.toMatch(/[_A-Z]{3,}/);
    }
  });
});

describe("lead taxonomy — resolving a lead's four-level path", () => {
  it("resolves all four levels for a real Match Fit lead", () => {
    const path = resolveLeadTaxonomyPath({
      venture: { slug: MATCH_FIT_VENTURE_SLUG, displayName: "Match Fit" },
      offering: {
        slug: "directory_listing",
        displayName: "Directory Listing",
        category: { slug: "fitness_pro_membership", displayName: "Fitness Pro Membership" },
      },
      taxonomyAudience: { code: "IP", displayName: "Independent Pro" },
    });

    expect(path.venture?.slug).toBe(MATCH_FIT_VENTURE_SLUG);
    expect(path.category?.slug).toBe("fitness_pro_membership");
    expect(path.offering?.slug).toBe("directory_listing");
    expect(path.audience?.code).toBe("IP");
    expect(path.isComplete).toBe(true);
    expect(path.label).toBe("Match Fit › Fitness Pro Membership › Directory Listing › Independent Pro");
  });

  it("resolves all four levels for a real NI Services lead", () => {
    const path = resolveLeadTaxonomyPath({
      venture: { slug: NI_SERVICES_VENTURE_SLUG, displayName: "NI Services" },
      offering: {
        slug: "custom_web_design_and_management",
        displayName: "Custom Web Design and Management",
        category: { slug: "intelligence_services", displayName: "Intelligence Services" },
      },
      taxonomyAudience: { code: "B2B", displayName: "Businesses" },
    });
    expect(path.isComplete).toBe(true);
    expect(path.label).toBe(
      "NI Services › Intelligence Services › Custom Web Design and Management › Businesses",
    );
  });

  it("degrades safely on a legacy row with NULL FKs", () => {
    const path = resolveLeadTaxonomyPath({});
    expect(path.isComplete).toBe(false);
    expect(path.venture).toBeNull();
    expect(path.category).toBeNull();
    expect(path.offering).toBeNull();
    expect(path.audience).toBeNull();
    expect(path.label).toBe("Not set › Not set › Not set › Not set");
    expect(resolveLeadTaxonomyPath(null).isComplete).toBe(false);
  });

  it("is incomplete when the offering resolved but its category did not", () => {
    const path = resolveLeadTaxonomyPath({
      venture: { slug: MATCH_FIT_VENTURE_SLUG, displayName: "Match Fit" },
      offering: { slug: "directory_listing", displayName: "Directory Listing" },
      taxonomyAudience: { code: "IP", displayName: "Independent Pro" },
    });
    expect(path.isComplete).toBe(false);
    expect(path.label).toContain("Not set");
  });
});

describe("lead taxonomy — current population", () => {
  it("is internally valid", () => {
    expect(validateLeadTaxonomyDefinition(LEAD_TAXONOMY_SEED)).toEqual([]);
  });

  it("gives Match Fit the three account tiers as audiences, not geography", () => {
    expect(seedAudiencesForVenture(MATCH_FIT_VENTURE_SLUG).map((a) => a.code)).toEqual(["FP", "IP", "EP"]);
    const labels = seedAudiencesForVenture(MATCH_FIT_VENTURE_SLUG).map((a) => a.displayName);
    expect(labels).toEqual(["Fitness Pro", "Independent Pro", "Elite Pro"]);
    // The dead geo values must never become audiences.
    for (const dead of DEAD_LEGACY_TARGET_GROUPS) {
      expect(LEAD_TAXONOMY_SEED.audiences.some((a) => a.code === dead)).toBe(false);
    }
  });

  it("gives NI Services B2B and B2C audiences and is not limited by industry", () => {
    expect(seedAudiencesForVenture(NI_SERVICES_VENTURE_SLUG).map((a) => a.code)).toEqual(["B2C", "B2B", "ENT"]);
    const ni = LEAD_TAXONOMY_SEED.ventures.find((v) => v.slug === NI_SERVICES_VENTURE_SLUG);
    expect(ni?.geographyNote).toContain("not limited by industry");
  });

  it("carries the NI web design offering that JB requires half the lead pool to pitch", () => {
    const webDesign = seedOfferingsForVenture(NI_SERVICES_VENTURE_SLUG).find(
      (o) => o.slug === "custom_web_design_and_management",
    );
    expect(webDesign).toBeDefined();
    expect(webDesign?.displayName).toBe("Custom Web Design and Management");
    expect(webDesign?.pushableByOutreach).toBe(true);
  });

  it("stores no price anywhere in the taxonomy", () => {
    expect(JSON.stringify(LEAD_TAXONOMY_SEED)).not.toMatch(/\$|\bprice\b|\busd\b/i);
    expect(MIGRATION_SQL).not.toMatch(/"price|priceUsd|monthly_price/i);
  });

  it("keeps every seeded offering under a category that belongs to the same venture", () => {
    for (const offering of LEAD_TAXONOMY_SEED.offerings) {
      const category = LEAD_TAXONOMY_SEED.categories.find(
        (c) => c.slug === offering.categorySlug && c.ventureSlug === offering.ventureSlug,
      );
      expect(category, `${offering.ventureSlug}/${offering.slug}`).toBeDefined();
    }
  });
});

describe("lead taxonomy — migration matches the seed (no drift)", () => {
  it("inserts every seeded venture, category, offering and audience", () => {
    for (const v of LEAD_TAXONOMY_SEED.ventures) {
      expect(MIGRATION_SQL, `venture ${v.slug}`).toContain(`'${v.slug}'`);
      expect(MIGRATION_SQL, `venture id ${v.slug}`).toContain(`'ven_${v.slug}'`);
    }
    for (const c of LEAD_TAXONOMY_SEED.categories) {
      expect(MIGRATION_SQL, `category ${c.slug}`).toContain(`'voc_${c.ventureSlug}__${c.slug}'`);
    }
    for (const o of LEAD_TAXONOMY_SEED.offerings) {
      expect(MIGRATION_SQL, `offering ${o.slug}`).toContain(`'vof_${o.ventureSlug}__${o.slug}'`);
    }
    for (const a of LEAD_TAXONOMY_SEED.audiences) {
      expect(MIGRATION_SQL, `audience ${a.code}`).toContain(
        `'vau_${a.ventureSlug}__${a.code.toLowerCase()}'`,
      );
    }
  });

  it("is additive: nothing is dropped and no row is deleted", () => {
    expect(MIGRATION_SQL).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT)\b/i);
    expect(MIGRATION_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(MIGRATION_SQL).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("leaves the legacy targetGroup column alone", () => {
    expect(MIGRATION_SQL).not.toMatch(/(ALTER|UPDATE)[^;]*"targetGroup"/i);
    // And the column is still declared on every lead model in the Prisma schema.
    expect(SCHEMA_PRISMA.match(/^\s*targetGroup\s+String/gm)?.length).toBeGreaterThanOrEqual(4);
  });

  it("only ever fills FKs that are still NULL, so a re-run cannot overwrite JB's edits", () => {
    const updates = MIGRATION_SQL.match(/UPDATE [^;]*?"ventureId" = 'ven_match_fit'[^;]*;/g) ?? [];
    expect(updates.length).toBe(4);
    for (const update of updates) {
      expect(update).toContain('"ventureId" IS NULL');
    }
    expect(MIGRATION_SQL).toContain('"audienceId" IS NULL');
    expect(MIGRATION_SQL).toContain('"offeringId" IS NULL');
  });
});

describe("lead taxonomy — legacy Match Fit rows", () => {
  it("maps outreachIntent onto the account tiers, since that is the only real signal", () => {
    expect(matchFitTaxonomyForLegacyLead({ outreachIntent: "LIST_WITH_US" })).toEqual({
      audienceCode: "IP",
      offeringSlug: "directory_listing",
    });
    expect(matchFitTaxonomyForLegacyLead({ outreachIntent: "JOIN_AS_FP" })).toEqual({
      audienceCode: "FP",
      offeringSlug: "premium_hub_access",
    });
    expect(matchFitTaxonomyForLegacyLead({ outreachIntent: "BOTH" })).toEqual({
      audienceCode: "EP",
      offeringSlug: "elite_full_access",
    });
  });

  it("refuses to derive an audience from the dead geo tagging", () => {
    for (const dead of DEAD_LEGACY_TARGET_GROUPS) {
      expect(matchFitTaxonomyForLegacyLead({ targetGroup: dead, outreachIntent: null })).toBeNull();
    }
    expect(matchFitTaxonomyForLegacyLead({ outreachIntent: "SOMETHING_ELSE" })).toBeNull();
    expect(matchFitTaxonomyForLegacyLead({})).toBeNull();
  });

  it("matches the SQL backfill in the migration exactly", () => {
    expect(MIGRATION_SQL).toContain("WHEN 'LIST_WITH_US' THEN 'vau_match_fit__ip'");
    expect(MIGRATION_SQL).toContain("WHEN 'JOIN_AS_FP'   THEN 'vau_match_fit__fp'");
    expect(MIGRATION_SQL).toContain("WHEN 'BOTH'         THEN 'vau_match_fit__ep'");
    expect(MIGRATION_SQL).toContain("WHEN 'LIST_WITH_US' THEN 'vof_match_fit__directory_listing'");
    expect(MIGRATION_SQL).toContain("WHEN 'JOIN_AS_FP'   THEN 'vof_match_fit__premium_hub_access'");
    expect(MIGRATION_SQL).toContain("WHEN 'BOTH'         THEN 'vof_match_fit__elite_full_access'");
  });
});
