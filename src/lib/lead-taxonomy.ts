/**
 * LEAD TAXONOMY — four levels, generic first.
 *
 * JB LOCKED, NI-Brain Decision #388 (2026-07-28):
 *   1. Venture   2. Offering category   3. Specific offering   4. Target audience
 *
 * The STRUCTURE is generic. Adding a new venture is data — rows in `ventures`,
 * `venture_offering_categories`, `venture_offerings`, `venture_audiences`. It is
 * never a migration, never an enum edit, never a change to this file's types.
 * The `LEAD_TAXONOMY_SEED` below is only the CURRENT population; nothing in the
 * resolver, the DPMO helpers or the Prisma schema reads it.
 *
 * DPMO push flexibility — JB LOCKED, Decision #389: every offering carries TWO
 * INDEPENDENT switches, `pushableByOutreach` and `pushableByMarketing`. An
 * offering can be outreach-only, marketing-only, both, or neither. They are
 * never hard-wired together.
 *
 * Geography is PER VENTURE (`geographyScope` / `geographyNote`), never a global
 * rule and never part of the audience level — Decision #342 killed geo tagging.
 *
 * This module is pure data + pure functions. No Prisma import, no `server-only`,
 * so it is safe from `"use client"` components.
 */

/* ------------------------------------------------------------------ */
/* Types — venture-agnostic. Never add a venture-specific field here.   */
/* ------------------------------------------------------------------ */

/** Level 1 — a venture (company) under Northside Ventures Group. */
export type LeadTaxonomyVenture = {
  slug: string;
  displayName: string;
  isActive: boolean;
  sortOrder: number;
  /** Free text so a new venture needs no migration: `nationwide`, `local`, `global`, … */
  geographyScope: string;
  /** Plain-English note for JB's screens. */
  geographyNote: string | null;
};

/** Level 2 — a category of offering, scoped to one venture. */
export type LeadTaxonomyCategory = {
  ventureSlug: string;
  slug: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

/** Level 3 — a specific offering, scoped to one category. */
export type LeadTaxonomyOffering = {
  ventureSlug: string;
  categorySlug: string;
  slug: string;
  displayName: string;
  summary: string | null;
  isActive: boolean;
  sortOrder: number;
  /** DPMO switch: may this offering be pushed by a DM or an email to a person? */
  pushableByOutreach: boolean;
  /** DPMO switch: may this offering be pushed by social content and ads? */
  pushableByMarketing: boolean;
};

/** Level 4 — a target audience, scoped to one venture. */
export type LeadTaxonomyAudience = {
  ventureSlug: string;
  code: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type LeadTaxonomyDefinition = {
  ventures: LeadTaxonomyVenture[];
  categories: LeadTaxonomyCategory[];
  offerings: LeadTaxonomyOffering[];
  audiences: LeadTaxonomyAudience[];
};

/** The resolved four-level path for one lead. Any level may be unset on a legacy row. */
export type LeadTaxonomyPath = {
  venture: { slug: string; displayName: string } | null;
  category: { slug: string; displayName: string } | null;
  offering: { slug: string; displayName: string } | null;
  audience: { code: string; displayName: string } | null;
  /** True only when all four levels resolved. */
  isComplete: boolean;
  /** Plain-English breadcrumb for JB's screens — never shows a slug or a code. */
  label: string;
};

/** How an offering may be pushed. Derived from the two switches, never stored. */
export type LeadTaxonomyPushMode = "both" | "outreach_only" | "marketing_only" | "not_pushed";

/* ------------------------------------------------------------------ */
/* Pure helpers — these are the generic engine. No venture names here.  */
/* ------------------------------------------------------------------ */

/** Shape a lead's joined taxonomy rows arrive in (Prisma include or a plain object). */
export type LeadTaxonomyJoin = {
  venture?: { slug: string; displayName: string } | null;
  offering?:
    | {
        slug: string;
        displayName: string;
        category?: { slug: string; displayName: string } | null;
      }
    | null;
  taxonomyAudience?: { code: string; displayName: string } | null;
};

const UNSET = "Not set";

/**
 * Resolve a lead's full four-level path. Level 2 always comes THROUGH the
 * offering — it is never stored on the lead, so it cannot drift out of sync.
 */
export function resolveLeadTaxonomyPath(lead: LeadTaxonomyJoin | null | undefined): LeadTaxonomyPath {
  const venture = lead?.venture
    ? { slug: lead.venture.slug, displayName: lead.venture.displayName }
    : null;
  const offering = lead?.offering
    ? { slug: lead.offering.slug, displayName: lead.offering.displayName }
    : null;
  const category = lead?.offering?.category
    ? { slug: lead.offering.category.slug, displayName: lead.offering.category.displayName }
    : null;
  const audience = lead?.taxonomyAudience
    ? { code: lead.taxonomyAudience.code, displayName: lead.taxonomyAudience.displayName }
    : null;

  const isComplete = Boolean(venture && category && offering && audience);
  const label = [
    venture?.displayName ?? UNSET,
    category?.displayName ?? UNSET,
    offering?.displayName ?? UNSET,
    audience?.displayName ?? UNSET,
  ].join(" › ");

  return { venture, category, offering, audience, isComplete, label };
}

/** Read the two independent DPMO switches as one mode. Never used to SET them. */
export function leadTaxonomyPushMode(offering: {
  pushableByOutreach: boolean;
  pushableByMarketing: boolean;
}): LeadTaxonomyPushMode {
  if (offering.pushableByOutreach && offering.pushableByMarketing) return "both";
  if (offering.pushableByOutreach) return "outreach_only";
  if (offering.pushableByMarketing) return "marketing_only";
  return "not_pushed";
}

/** Plain-English label for a push mode. No raw values on JB's screens. */
export const LEAD_TAXONOMY_PUSH_MODE_LABELS: Record<LeadTaxonomyPushMode, string> = {
  both: "Outreach and marketing",
  outreach_only: "Outreach only",
  marketing_only: "Marketing only",
  not_pushed: "Not being pushed",
};

/** Offerings this venture may push by DM or email right now. */
export function offeringsPushableByOutreach<T extends { pushableByOutreach: boolean; isActive: boolean }>(
  offerings: readonly T[],
): T[] {
  return offerings.filter((o) => o.isActive && o.pushableByOutreach);
}

/** Offerings this venture may push by social content or ads right now. */
export function offeringsPushableByMarketing<T extends { pushableByMarketing: boolean; isActive: boolean }>(
  offerings: readonly T[],
): T[] {
  return offerings.filter((o) => o.isActive && o.pushableByMarketing);
}

/**
 * Validate any taxonomy definition — including one for a venture that does not
 * exist yet. Returns problems as plain sentences; an empty array means valid.
 * Nothing here knows the name of a single venture.
 */
export function validateLeadTaxonomyDefinition(def: LeadTaxonomyDefinition): string[] {
  const problems: string[] = [];
  const ventureSlugs = new Set<string>();
  for (const v of def.ventures) {
    if (ventureSlugs.has(v.slug)) problems.push(`Duplicate venture "${v.slug}".`);
    ventureSlugs.add(v.slug);
  }

  const categoryKeys = new Set<string>();
  for (const c of def.categories) {
    if (!ventureSlugs.has(c.ventureSlug)) {
      problems.push(`Category "${c.slug}" points at unknown venture "${c.ventureSlug}".`);
    }
    const key = `${c.ventureSlug}/${c.slug}`;
    if (categoryKeys.has(key)) problems.push(`Duplicate category "${key}".`);
    categoryKeys.add(key);
  }

  const offeringKeys = new Set<string>();
  for (const o of def.offerings) {
    if (!ventureSlugs.has(o.ventureSlug)) {
      problems.push(`Offering "${o.slug}" points at unknown venture "${o.ventureSlug}".`);
    }
    if (!categoryKeys.has(`${o.ventureSlug}/${o.categorySlug}`)) {
      problems.push(`Offering "${o.slug}" points at unknown category "${o.categorySlug}".`);
    }
    const key = `${o.ventureSlug}/${o.slug}`;
    if (offeringKeys.has(key)) problems.push(`Duplicate offering "${key}".`);
    offeringKeys.add(key);
  }

  const audienceKeys = new Set<string>();
  for (const a of def.audiences) {
    if (!ventureSlugs.has(a.ventureSlug)) {
      problems.push(`Audience "${a.code}" points at unknown venture "${a.ventureSlug}".`);
    }
    const key = `${a.ventureSlug}/${a.code}`;
    if (audienceKeys.has(key)) problems.push(`Duplicate audience "${key}".`);
    audienceKeys.add(key);
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* Legacy geo mapping — targetGroup is DEAD (Decision #342).            */
/* ------------------------------------------------------------------ */

/**
 * The old `targetGroup` values. Retained on the lead tables for history only and
 * never written again. They carry NO audience meaning: geo tagging was killed,
 * and JB's audiences are account tiers. Anything reading `targetGroup` to decide
 * who a lead is should read the taxonomy FKs instead.
 */
export const DEAD_LEGACY_TARGET_GROUPS = ["ATL_LOCAL", "VIRTUAL"] as const;

/**
 * Match Fit backfill rule. `outreachIntent` is the only column on the existing
 * rows that carries real audience meaning, and it maps exactly onto JB's tiers.
 * `targetGroup` maps onto nothing and is deliberately ignored.
 */
export const MATCH_FIT_INTENT_TO_TAXONOMY: Record<
  string,
  { audienceCode: string; offeringSlug: string }
> = {
  LIST_WITH_US: { audienceCode: "IP", offeringSlug: "directory_listing" },
  JOIN_AS_FP: { audienceCode: "FP", offeringSlug: "premium_hub_access" },
  BOTH: { audienceCode: "EP", offeringSlug: "elite_full_access" },
};

/** Returns the taxonomy a legacy Match Fit lead backfills to, or null if unknowable. */
export function matchFitTaxonomyForLegacyLead(lead: {
  outreachIntent?: string | null;
  targetGroup?: string | null;
}): { audienceCode: string; offeringSlug: string } | null {
  const intent = lead.outreachIntent?.trim().toUpperCase();
  if (!intent) return null;
  return MATCH_FIT_INTENT_TO_TAXONOMY[intent] ?? null;
}

/* ------------------------------------------------------------------ */
/* CURRENT POPULATION — data only. Delete a venture here and the engine  */
/* above still works untouched. Add one here and nothing else changes.   */
/* ------------------------------------------------------------------ */

export const MATCH_FIT_VENTURE_SLUG = "match_fit";
export const NI_SERVICES_VENTURE_SLUG = "ni_services";

const matchFitOffering = (
  categorySlug: string,
  slug: string,
  displayName: string,
  summary: string,
  sortOrder: number,
  pushableByOutreach: boolean,
  pushableByMarketing: boolean,
): LeadTaxonomyOffering => ({
  ventureSlug: MATCH_FIT_VENTURE_SLUG,
  categorySlug,
  slug,
  displayName,
  summary,
  isActive: true,
  sortOrder,
  pushableByOutreach,
  pushableByMarketing,
});

const niOffering = (
  categorySlug: string,
  slug: string,
  displayName: string,
  sortOrder: number,
  pushableByOutreach: boolean,
  pushableByMarketing: boolean,
): LeadTaxonomyOffering => ({
  ventureSlug: NI_SERVICES_VENTURE_SLUG,
  categorySlug,
  slug,
  displayName,
  summary: null,
  isActive: true,
  sortOrder,
  pushableByOutreach,
  pushableByMarketing,
});

export const LEAD_TAXONOMY_SEED: LeadTaxonomyDefinition = {
  ventures: [
    {
      slug: MATCH_FIT_VENTURE_SLUG,
      displayName: "Match Fit",
      isActive: true,
      sortOrder: 1,
      geographyScope: "nationwide",
      geographyNote: "Online / virtual coaches, nationwide. No city, no region, no map.",
    },
    {
      slug: NI_SERVICES_VENTURE_SLUG,
      displayName: "NI Services",
      isActive: true,
      sortOrder: 2,
      geographyScope: "nationwide",
      geographyNote: "Sold online. B2B and B2C, not limited by industry.",
    },
  ],

  categories: [
    {
      ventureSlug: MATCH_FIT_VENTURE_SLUG,
      slug: "fitness_pro_membership",
      displayName: "Fitness Pro Membership",
      description: "What a coach joins Match Fit as.",
      isActive: true,
      sortOrder: 1,
    },
    {
      ventureSlug: MATCH_FIT_VENTURE_SLUG,
      slug: "client_membership",
      displayName: "Client Membership",
      description: "What a client joins Match Fit as.",
      isActive: true,
      sortOrder: 2,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      slug: "intelligence_tools",
      displayName: "Intelligence Tools",
      description: "Self-serve tools on the NI portal.",
      isActive: true,
      sortOrder: 1,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      slug: "intelligence_services",
      displayName: "Intelligence Services",
      description: "Done-for-you projects, quoted individually.",
      isActive: true,
      sortOrder: 2,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      slug: "subscription_plans",
      displayName: "Subscription Plans",
      description: "Portal-wide plans covering the tools.",
      isActive: true,
      sortOrder: 3,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      slug: "smart_store",
      displayName: "Smart Store",
      description: "Daily curated product marketplace.",
      isActive: true,
      sortOrder: 4,
    },
  ],

  offerings: [
    // --- Match Fit: the three tiers JB pitches, mapped to the three audiences.
    matchFitOffering(
      "fitness_pro_membership",
      "premium_hub_access",
      "Premium Hub Access",
      "Premium access for a Fitness Pro.",
      1,
      true,
      true,
    ),
    matchFitOffering(
      "fitness_pro_membership",
      "directory_listing",
      "Directory Listing",
      "Listing access for an Independent Pro.",
      2,
      true,
      true,
    ),
    matchFitOffering(
      "fitness_pro_membership",
      "elite_full_access",
      "Elite Full Access",
      "Premium access and listing access together.",
      3,
      true,
      true,
    ),
    matchFitOffering(
      "client_membership",
      "client_vip",
      "Client VIP",
      "Paid client membership.",
      1,
      false,
      true,
    ),

    // --- NI Services: tools (verified on the live portal).
    niOffering("intelligence_tools", "replyflow", "ReplyFlow", 1, true, true),
    niOffering("intelligence_tools", "grantbot", "GrantBot", 2, false, true),
    niOffering("intelligence_tools", "signaldesk", "Signal Desk", 3, false, true),
    niOffering("intelligence_tools", "gapscan", "GapScan", 4, false, true),
    niOffering("intelligence_tools", "bridgeai", "BridgeAI", 5, false, true),

    // --- NI Services: the 11 services listed on the live portal /services page.
    // Web design first: JB requires at least half the NI lead pool to be web design.
    niOffering(
      "intelligence_services",
      "custom_web_design_and_management",
      "Custom Web Design and Management",
      1,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "executive_briefing_intelligence",
      "Executive Briefing Intelligence",
      2,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "ai_research_assistant_setup",
      "AI Research Assistant Setup",
      3,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "personal_intelligence_setup",
      "Personal Intelligence Setup",
      4,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "personal_knowledge_base_build",
      "Personal Knowledge Base Build",
      5,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "intelligence_audit_and_gap_analysis",
      "Intelligence Audit & Gap Analysis",
      6,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "tailored_intelligence_server",
      "Tailored Intelligence Server",
      7,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "team_intelligence_training_and_onboarding",
      "Team Intelligence Training & Onboarding",
      8,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "workflow_integration_and_automation",
      "Workflow Integration & Automation",
      9,
      true,
      true,
    ),
    niOffering(
      "intelligence_services",
      "ai_governance_and_compliance_framework",
      "AI Governance & Compliance Framework",
      10,
      true,
      true,
    ),
    niOffering("intelligence_services", "enterprise_ai_strategy", "Enterprise AI Strategy", 11, true, true),

    // --- NI Services: plans and store (marketing surfaces, not person-to-person pitches).
    niOffering("subscription_plans", "plan_free", "Free Plan", 1, false, true),
    niOffering("subscription_plans", "plan_core", "Core Plan", 2, false, true),
    niOffering("subscription_plans", "plan_pro", "Pro Plan", 3, false, true),
    niOffering("subscription_plans", "plan_power", "Power Plan", 4, false, true),
    niOffering("smart_store", "smart_store", "Smart Store", 1, false, true),
  ],

  audiences: [
    // Match Fit audiences are ACCOUNT TIERS, not geography (Decision #388).
    {
      ventureSlug: MATCH_FIT_VENTURE_SLUG,
      code: "FP",
      displayName: "Fitness Pro",
      description: "Premium access.",
      isActive: true,
      sortOrder: 1,
    },
    {
      ventureSlug: MATCH_FIT_VENTURE_SLUG,
      code: "IP",
      displayName: "Independent Pro",
      description: "Listing access.",
      isActive: true,
      sortOrder: 2,
    },
    {
      ventureSlug: MATCH_FIT_VENTURE_SLUG,
      code: "EP",
      displayName: "Elite Pro",
      description: "Premium access and listing access.",
      isActive: true,
      sortOrder: 3,
    },
    // NI Services audiences follow the eligibility labels on the live portal.
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      code: "B2C",
      displayName: "Individuals",
      description: "A person buying for themselves.",
      isActive: true,
      sortOrder: 1,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      code: "B2B",
      displayName: "Businesses",
      description: "Any company, any industry.",
      isActive: true,
      sortOrder: 2,
    },
    {
      ventureSlug: NI_SERVICES_VENTURE_SLUG,
      code: "ENT",
      displayName: "Enterprise",
      description: "Large organisations.",
      isActive: true,
      sortOrder: 3,
    },
  ],
};

/** Every offering belonging to one venture, in display order. */
export function seedOfferingsForVenture(ventureSlug: string): LeadTaxonomyOffering[] {
  return LEAD_TAXONOMY_SEED.offerings
    .filter((o) => o.ventureSlug === ventureSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every audience belonging to one venture, in display order. */
export function seedAudiencesForVenture(ventureSlug: string): LeadTaxonomyAudience[] {
  return LEAD_TAXONOMY_SEED.audiences
    .filter((a) => a.ventureSlug === ventureSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
