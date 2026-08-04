/**
 * OFFERING DPMO — Dual-Phase Marketing & Outreach, one record per offering.
 *
 * JB LOCKED (2026-07-28). DPMO = **Dual-Phase Marketing & Outreach.**
 *   Phase 1 = first revenue.  Phase 2 = retain and scale.
 *
 * TWO ADAPTABLE SKELETONS PER OFFERING, built differently per sector by autonomy:
 *   - MARKETING skeleton = social content + ads.
 *   - OUTREACH  skeleton = a DM or an email to a person.
 * They are separate objects. One is never derived from the other.
 *
 * FOUNDATION RULE (every sector, no exceptions):
 *   Outreach = 1 personal line + 1 benefit + 1 link. NO question. NO call.
 *   Content  = every post helps them and ends with ONE link.
 *   Guardrails = no phone calls, little back-and-forth, finish the signup.
 *
 * ── THE TWO SWITCHES ────────────────────────────────────────────────────────
 * There are two INDEPENDENT layers, and four booleans in total. Neither switch
 * ever implies the other, and marketing never implies outreach.
 *
 *   LAYER 1 — ELIGIBILITY, on `venture_offerings`:
 *     `pushableByOutreach` / `pushableByMarketing`
 *     "May this offering EVER be pushed this way?" Set by the sector shape.
 *     Sector 4 and the subscription plans are marketing-eligible only; Sector 5
 *     is never outreach-eligible.
 *
 *   LAYER 2 — JB'S LIVE SWITCH, on `venture_offering_dpmo`:
 *     `marketingEnabled` / `outreachEnabled` — **BOTH DEFAULT FALSE.**
 *     Nothing is being pushed until JB turns it on. He sets his own strategy.
 *
 *   EFFECTIVE PUSH = eligibility AND enabled, per channel, per offering.
 *   That gives outreach-only, marketing-only, both, or neither — for every
 *   offering independently.
 *
 * DRAFT/CONFIG ONLY. Nothing in this module sends, posts, or spends.
 * PRICES come from the live portal, verified 2026-07-28. Never from memory.
 * NO GEOGRAPHY anywhere. Hashtags are chosen at post time from real
 * high-follower tags via `content-calendar/hashtag-research` — never invented.
 */

/* ------------------------------------------------------------------ */
/* Types — venture-agnostic and sector-agnostic. Free text on purpose.  */
/* ------------------------------------------------------------------ */

/** Which DPMO phase this offering is running right now. */
export type DpmoPhase =
  /** Sector 2 shape — no product yet, audience-building only. */
  | "phase_0"
  /** First revenue. */
  | "phase_1"
  /** Retain and scale. */
  | "phase_2";

/**
 * How the outreach skeleton reaches a person. Free text in the DB so a new
 * surface needs no migration. `none` means this offering has no person-to-person
 * push at all (Sector 5 today).
 */
export type DpmoOutreachChannel =
  | "instagram_dm"
  | "linkedin_dm"
  | "email"
  | "in_app"
  | "none";

/** The marketing skeleton — social content and ads. Never sends anything. */
export type DpmoMarketingSkeleton = {
  /** The content angle. What the post is actually about, concretely. */
  angle: string;
  /** The real proof shown in the post. Never an invented person or testimonial. */
  proof: string;
  /** The one call to action. Every post ends with one link. */
  cta: string;
  /** That one link. */
  link: string;
  /** Where this runs. */
  channels: string[];
  /** How often, and in which format. */
  cadence: string;
  /** Anything sector-specific a writer must obey. */
  notes: string | null;
};

/** The outreach skeleton — a DM or an email to one person. Never sends anything. */
export type DpmoOutreachSkeleton = {
  channel: DpmoOutreachChannel;
  /** Line 1. The personal line — what the agent must actually look at first. */
  opener: string;
  /** Line 2. The single benefit. */
  benefit: string;
  /** Line 3. The single link. Nothing after it. */
  link: string;
  /** Sector-specific guardrails on top of the foundation rule. */
  notes: string | null;
};

/** One offering's complete DPMO. */
export type OfferingDpmo = {
  ventureSlug: string;
  offeringSlug: string;
  /** `1A`, `1B`, `2`, `3`, `4`, `5`, or `services`. Free text. */
  sector: string;
  phase: DpmoPhase;
  /** JB's live switch. DEFAULT FALSE. */
  marketingEnabled: boolean;
  /** JB's live switch. DEFAULT FALSE. */
  outreachEnabled: boolean;
  marketing: DpmoMarketingSkeleton;
  outreach: DpmoOutreachSkeleton;
  /** The single deliverable/benefit line, shared by both skeletons. */
  benefitLine: string;
  /** Price exactly as the live portal shows it. Never from memory. */
  priceNote: string;
};

export type DpmoPushMode = "both" | "outreach_only" | "marketing_only" | "not_pushed";

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Effective push, per channel. Eligibility AND the live switch.
 * The two channels are resolved separately — one never implies the other.
 */
export function effectiveDpmoPush(input: {
  pushableByOutreach: boolean;
  pushableByMarketing: boolean;
  outreachEnabled: boolean;
  marketingEnabled: boolean;
  isActive?: boolean;
}): { outreach: boolean; marketing: boolean; mode: DpmoPushMode } {
  const active = input.isActive ?? true;
  const outreach = active && input.pushableByOutreach && input.outreachEnabled;
  const marketing = active && input.pushableByMarketing && input.marketingEnabled;
  const mode: DpmoPushMode =
    outreach && marketing
      ? "both"
      : outreach
        ? "outreach_only"
        : marketing
          ? "marketing_only"
          : "not_pushed";
  return { outreach, marketing, mode };
}

/** Plain-English label. No raw values on JB's screens. */
export const DPMO_PUSH_MODE_LABELS: Record<DpmoPushMode, string> = {
  both: "Being pushed by outreach and marketing",
  outreach_only: "Being pushed by outreach only",
  marketing_only: "Being pushed by marketing only",
  not_pushed: "Not being pushed",
};

export const DPMO_PHASE_LABELS: Record<DpmoPhase, string> = {
  phase_0: "Audience building — no offer yet",
  phase_1: "Phase 1 — first revenue",
  phase_2: "Phase 2 — retain and scale",
};

/**
 * The rendered three-line outreach draft. DRAFT ONLY — this returns a string,
 * it never sends. `personalLine` is written per lead by the agent that read the
 * person's most recent post; it is never templated here.
 */
export function renderDpmoOutreachDraft(
  skeleton: DpmoOutreachSkeleton,
  personalLine: string,
): string {
  return [personalLine.trim(), skeleton.benefit.trim(), skeleton.link.trim()].join("\n\n");
}

/** Foundation rule check — draft must be 3 blocks, no question mark, no call ask. */
export function validateDpmoOutreachDraft(draft: string): string[] {
  const problems: string[] = [];
  const blocks = draft.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length !== 3) {
    problems.push("Outreach must be exactly 1 personal line + 1 benefit + 1 link.");
  }
  if (draft.includes("?")) problems.push("Outreach must not ask a question.");
  if (/\b(call|hop on|jump on|quick chat|schedule a time|book a time|phone)\b/i.test(draft)) {
    problems.push("Outreach must never ask for a call.");
  }
  return problems;
}

/** Every DPMO in one sector. */
export function dpmoForSector(sector: string): OfferingDpmo[] {
  return OFFERING_DPMO_SEED.filter((d) => d.sector === sector);
}

/** One offering's DPMO. */
export function dpmoForOffering(ventureSlug: string, offeringSlug: string): OfferingDpmo | undefined {
  return OFFERING_DPMO_SEED.find(
    (d) => d.ventureSlug === ventureSlug && d.offeringSlug === offeringSlug,
  );
}

/* ------------------------------------------------------------------ */
/* Shared constants                                                     */
/* ------------------------------------------------------------------ */

const MF = "match_fit";
const NI = "ni_services";

const MF_LINK = "https://match-fit.net";
const NI_LINK = "https://northsideintelligence.com";

const MF_CHANNELS = ["Instagram", "TikTok", "Facebook Page", "Threads"];
const NI_CHANNELS = ["LinkedIn", "Reddit", "Instagram"];

/** Applies to every marketing skeleton. Enforced at post time, never invented. */
export const DPMO_HASHTAG_RULE =
  "High-follower existing tags only, chosen from real volume data at post time. Never invent a brand tag. At most one brand tag, only alongside four or more big ones.";

/** Applies to every outreach skeleton. */
export const DPMO_FOUNDATION_RULE =
  "1 personal line + 1 benefit + 1 link. No question. No call. Little back-and-forth. Finish the signup.";

/** Sector 5 only, and it is absolute. */
export const AXON_LANGUAGE_GUARDRAIL =
  "No ASI or AGI language, ever, in any AXON marketing or investor material.";

/* ------------------------------------------------------------------ */
/* THE DPMO RECORDS — one per live offering.                            */
/* Prices verified on the live portals 2026-07-28.                      */
/* Both live switches ship FALSE. JB sets his own strategy.             */
/* ------------------------------------------------------------------ */

export const OFFERING_DPMO_SEED: OfferingDpmo[] = [
  /* ================================================================ */
  /* SECTOR 1A — Match Fit. Own brand, highest personal touch,         */
  /* approval-gated. Two-sided marketplace, so both sides get seeded.  */
  /* ================================================================ */
  {
    ventureSlug: MF,
    offeringSlug: "premium_hub_access",
    sector: "1A",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine:
      "Featured placement plus the publishing studio and promotion tokens, so clients find your page instead of you chasing them.",
    priceNote: "Premium Page add-on, $20/month. Verified on match-fit.net 2026-07-28.",
    marketing: {
      angle:
        "Screen-record the Premium Hub doing the work: featured placement turning on, the publishing studio composing a FitHub post, promotion tokens being spent. Show the surface, do not describe it.",
      proof: "Real founding-coach pages already running featured placement. No invented coaches, no fabricated testimonials.",
      cta: "One link at the end of the caption: set your coach page up.",
      link: MF_LINK,
      channels: MF_CHANNELS,
      cadence:
        "Match Fit Marketing workflow — 8am generation, carousel + static + video, white frame in every prompt and cropped out before upload.",
      notes: `${DPMO_HASHTAG_RULE} Nationwide, online and virtual coaches. No city, no region, no map, not even in a comment.`,
    },
    outreach: {
      channel: "instagram_dm",
      opener:
        "Read their three most recent posts by DATE and write one true line about the most recent one. Confirm it is the right person before anything is drafted.",
      benefit:
        "Premium Hub puts your page in front of clients already searching — featured placement, a publishing studio and promotion tokens for $20 a month.",
      link: MF_LINK,
      notes: `${DPMO_FOUNDATION_RULE} Sector 1A is the highest personal touch of any sector and still never calls. Emails send from jb@match-fit.net using RESEND_API_KEY.`,
    },
  },
  {
    ventureSlug: MF,
    offeringSlug: "directory_listing",
    sector: "1A",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine:
      "Ten discovery nudges a day to opted-in clients, plus an external website listing with trust indicators.",
    priceNote: "Independent Pro, $15.00/month. Verified on match-fit.net 2026-07-28.",
    marketing: {
      angle:
        "Show a nudge going out and a client opening it. The angle is reach without cold DMs — the listing does the introducing.",
      proof: "The live listing surface itself, recorded on screen.",
      cta: "One link: get listed.",
      link: MF_LINK,
      channels: MF_CHANNELS,
      cadence: "Match Fit Marketing workflow, same 8am generation and approval gate.",
      notes: `${DPMO_HASHTAG_RULE} Never change a post's format — a carousel stays a carousel.`,
    },
    outreach: {
      channel: "instagram_dm",
      opener:
        "One true line about their most recent post, read by date. No generic compliment, no invented detail.",
      benefit:
        "An Independent Pro listing sends ten discovery nudges a day to clients who already opted in, and gives you an external website listing with trust indicators for $15 a month.",
      link: MF_LINK,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: MF,
    offeringSlug: "elite_full_access",
    sector: "1A",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine:
      "Unlimited discovery nudges, business email and external links allowed in chat, and a verified business badge with analytics.",
    priceNote: "Elite Pro, $40.00/month. Verified on match-fit.net 2026-07-28.",
    marketing: {
      angle:
        "The verification story. Show the background screening and document review that produce the verified business badge, then show the analytics screen it unlocks.",
      proof: "The real verification flow and the real analytics screen.",
      cta: "One link: start verification.",
      link: MF_LINK,
      channels: MF_CHANNELS,
      cadence: "Match Fit Marketing workflow.",
      notes: `${DPMO_HASHTAG_RULE} Elite is the only tier where business email and external links are allowed in chat — never imply that for the other tiers.`,
    },
    outreach: {
      channel: "instagram_dm",
      opener: "One true line about their most recent post, read by date.",
      benefit:
        "Elite Pro is unlimited discovery nudges, your business email and links allowed in chat, and a verified business badge with analytics for $40 a month.",
      link: MF_LINK,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: MF,
    offeringSlug: "client_vip",
    sector: "1A",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine:
      "Unlimited coach discovery, full in-app chat and booking, complete FitHub access, and a daily match questionnaire.",
    priceNote: "Client VIP, $10.00/month. Free plan is $0 with 10 swipes per 12 hours. Verified on match-fit.net 2026-07-28.",
    marketing: {
      angle:
        "The free plan is the hook. Show the 10-swipe limit being hit, then show unlimited swipe and scroll feeds on VIP. The limit is the story.",
      proof: "The real free-plan limit screen and the real VIP feed.",
      cta: "One link: start free.",
      link: MF_LINK,
      channels: MF_CHANNELS,
      cadence: "Match Fit Marketing workflow.",
      notes: `${DPMO_HASHTAG_RULE} Client side is content-pull only.`,
    },
    outreach: {
      channel: "none",
      opener:
        "Not outreach-eligible. Clients are never cold-DMed — they arrive from content and from the free plan.",
      benefit:
        "Unlimited coach discovery, full chat and booking, and a daily match questionnaire for $10 a month.",
      link: MF_LINK,
      notes:
        "Skeleton is written and parked so it exists if JB ever flips client outreach on. Outreach eligibility is OFF at the taxonomy layer, so the live switch alone cannot start it.",
    },
  },

  /* ================================================================ */
  /* SECTOR 3 — Product-led, free-first. Most automated sector, near   */
  /* zero JB. The product is the marketing. Real selling is the        */
  /* in-app upgrade nudge at the usage cap, not cold outreach.         */
  /* ================================================================ */
  {
    ventureSlug: NI,
    offeringSlug: "replyflow",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Customer replies drafted for you, so the inbox stops being the bottleneck.",
    priceNote:
      "Free plan: 10 replies a month. Paid: $15/month. Also covered by Core ($20/mo), Pro ($39/mo) and Power ($59/mo) plans. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "A 20-second screen clip: paste one real awkward customer message, ReplyFlow drafts the reply, the reply gets sent. No voiceover claim the clip does not show.",
      proof: "The tool itself running live. The product is the marketing.",
      cta: "One link: try it free, 10 replies a month, no card.",
      link: `${NI_LINK}/replyflow`,
      channels: NI_CHANNELS,
      cadence:
        "NI Marketing workflow — 8am generation on the NI content schedule; if a static image is attached the prompt carries the white frame and it is cropped before upload.",
      notes: `${DPMO_HASHTAG_RULE} One CTA only, and it is the free signup — never the paid price.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener:
        "One true line about something they published — a post about response times, support load, or an inbox they are drowning in. Read it first; never guess.",
      benefit:
        "ReplyFlow drafts your customer replies for you — the free plan does 10 a month with no card.",
      link: `${NI_LINK}/replyflow`,
      notes: `${DPMO_FOUNDATION_RULE} ReplyFlow is the ONE Sector 3 tool with cold-outreach eligibility, because it is the fast-money lead product. Everything else in Sector 3 upgrades in-app. Emails send from jb@northsideintelligence.com using RESEND_API_KEY_NI.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "grantbot",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Grants found and drafted for you, instead of a week lost to searching and rewriting.",
    priceNote:
      "Free plan: 5 grants a month. Paid: $39/month. Also covered by Core, Pro and Power plans. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "Show one real grant going from search result to a drafted application on screen. The whole clip is the search-to-draft jump.",
      proof: "The tool running live on a real public grant listing.",
      cta: "One link: try it free, 5 grants a month.",
      link: `${NI_LINK}/grantbot`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow, NI content schedule.",
      notes: `${DPMO_HASHTAG_RULE} Never imply a funding outcome or an approval rate.`,
    },
    outreach: {
      channel: "in_app",
      opener:
        "Fires when the free user hits 5 grants in a month. One line naming what they just did, in the app.",
      benefit:
        "You have used your 5 free grants this month. Unlimited grants is $39 a month, or included from the Core plan at $20 a month.",
      link: `${NI_LINK}/subscriptions`,
      notes:
        "In-app upgrade nudge only. Cold outreach is NOT eligible for this offering at the taxonomy layer — Sector 3 sells through the usage cap, not through DMs.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "signaldesk",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Every signal you track in one hub, so nothing important is found a week late.",
    priceNote:
      "Free plan: 10 signals a month. Paid: $24/month. Also covered by Core, Pro and Power plans. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "Show the hub catching one real signal the same day it broke, next to the tabs it replaces.",
      proof: "The live signals hub on screen.",
      cta: "One link: try it free, 10 signals a month.",
      link: `${NI_LINK}/signaldesk`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow, NI content schedule.",
      notes: `${DPMO_HASHTAG_RULE} No financial advice framing, ever.`,
    },
    outreach: {
      channel: "in_app",
      opener: "Fires at 10 signals in a month. One line naming the signal they just tracked.",
      benefit:
        "You have used your 10 free signals this month. Unlimited is $24 a month, or included from the Core plan at $20 a month.",
      link: `${NI_LINK}/subscriptions`,
      notes: "In-app upgrade nudge only. Cold outreach is not eligible for this offering.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "gapscan",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "The gap in your workflow named for you, before it costs you a month.",
    priceNote:
      "Free plan: 10 scans a month. Paid: $18/month. Also covered by Core, Pro and Power plans. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "Run one scan on a real, messy workflow on screen and read the top three gaps it returns out loud. The output is the whole post.",
      proof: "The live scan output.",
      cta: "One link: run a free scan, 10 a month.",
      link: `${NI_LINK}/gapscan`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow, NI content schedule.",
      notes: `${DPMO_HASHTAG_RULE} Show the real output even when it is unflattering.`,
    },
    outreach: {
      channel: "in_app",
      opener: "Fires at 10 scans in a month. One line naming the workflow they just scanned.",
      benefit:
        "You have used your 10 free scans this month. Unlimited is $18 a month, or included from the Core plan at $20 a month.",
      link: `${NI_LINK}/subscriptions`,
      notes: "In-app upgrade nudge only. Cold outreach is not eligible for this offering.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "bridgeai",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Two tools that never talked to each other, wired together and running by themselves.",
    priceNote:
      "Free plan: 10 workflows a month. Paid: $29/month. Also covered by Core, Pro and Power plans. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "Build one real bridge on screen end to end — trigger, handoff, result — in under a minute, with no editing cuts hiding a failure.",
      proof: "The live bridge running.",
      cta: "One link: build one free, 10 workflows a month.",
      link: `${NI_LINK}/bridgeai`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow, NI content schedule.",
      notes: `${DPMO_HASHTAG_RULE} Highest demand signal in Sector 3 — this is the one to test ads on first if JB turns ads on.`,
    },
    outreach: {
      channel: "in_app",
      opener: "Fires at 10 workflows in a month. One line naming the bridge they just built.",
      benefit:
        "You have used your 10 free workflows this month. Unlimited is $29 a month, or included from the Core plan at $20 a month.",
      link: `${NI_LINK}/subscriptions`,
      notes: "In-app upgrade nudge only. Cold outreach is not eligible for this offering.",
    },
  },

  /* ================================================================ */
  /* NI SERVICES — done-for-you projects. Outreach-led, marketing      */
  /* supports. Web design carries at least half the NI lead pool.      */
  /* ================================================================ */
  {
    ventureSlug: NI,
    offeringSlug: "custom_web_design_and_management",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine:
      "A custom site plus the hosting, updates, security and analytics — one bill, nobody to chase.",
    priceNote:
      "$499 – $2,500 for an individual, $2,500 – $50,000+ for a business. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Before and after of one real site, with the load time and the mobile layout shown, not claimed. Then the part nobody else includes: hosting, updates, security and analytics on the same bill.",
      proof: "Live sites already built and managed. Never a mockup presented as a client.",
      cta: "One link: see what a build costs.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow, NI content schedule.",
      notes: `${DPMO_HASHTAG_RULE} This is the highest-priority NI service — JB requires at least half the NI lead pool to be web design.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener:
        "One true line about THEIR site — something you actually loaded and looked at. Name the specific thing, never 'I saw your website'.",
      benefit:
        "We build custom sites and then run them — hosting, updates, security and analytics included, from $499 for an individual and $2,500 for a business.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} Half of every NI outreach batch is this offering. Email from jb@northsideintelligence.com with RESEND_API_KEY_NI.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "executive_briefing_intelligence",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "A daily and weekly briefing built on your interests, delivered without you asking.",
    priceNote: "$39 – $79/month. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Publish one real anonymised briefing as a carousel — the actual format, the actual length, the actual sources line. Let the artefact sell it.",
      proof: "A real briefing, redacted.",
      cta: "One link: get your own briefing set up.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. Lowest-priced service, so it is the entry point in a Phase 1 ladder.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "email",
      opener:
        "One true line about a topic they publicly track — quote the thing they said, not the topic in general.",
      benefit:
        "We build you a daily and weekly briefing on exactly the things you track, from $39 a month.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} Cheapest entry point — use it when a lead is warm but not ready for a build.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "ai_research_assistant_setup",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "A research assistant trained on your own sources, so the answers stop being generic.",
    priceNote: "$99 – $399. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Ask a generic assistant and a domain-trained one the same hard question, side by side, on screen. The gap is the post.",
      proof: "The two real answers.",
      cta: "One link: have one set up on your sources.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "email",
      opener: "One true line about the specific research they do — cite the actual piece of theirs you read.",
      benefit:
        "We set up a research assistant trained on your own sources so the answers are yours, not generic, from $99.",
      link: `${NI_LINK}/services`,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "personal_intelligence_setup",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Your whole personal setup configured around how you actually work, in one pass.",
    priceNote: "$149 – $499. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "A day-in-the-life screen tour of a configured personal environment — capture, research, decisions — with nothing staged.",
      proof: "The configured environment itself.",
      cta: "One link: have yours set up.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "email",
      opener: "One true line about the specific way they said they work.",
      benefit:
        "We configure a personal intelligence setup around how you already work, from $149.",
      link: `${NI_LINK}/services`,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "personal_knowledge_base_build",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Everything you already wrote, made searchable and wired into your AI tools.",
    priceNote: "$149 – $449. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Show one messy folder of notes turned into a searchable base, then ask the base a question and get the answer with a source.",
      proof: "The real before-and-after and the real answer with its citation.",
      cta: "One link: have yours built.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "email",
      opener: "One true line about the body of work they have already published.",
      benefit:
        "We turn what you have already written into a searchable knowledge base wired into your AI tools, from $149.",
      link: `${NI_LINK}/services`,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "intelligence_audit_and_gap_analysis",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "A ranked list of exactly where your systems leak, plus a 30-day follow-up.",
    priceNote:
      "$299 – $799 for an individual, $2,500 – $5,000 for a business. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Publish the audit format itself — the mapping page, the gap page, the ranked roadmap page — as a carousel. Showing the deliverable is the sell.",
      proof: "A real redacted audit.",
      cta: "One link: book an audit.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: `${DPMO_HASHTAG_RULE} This is the natural door-opener before any larger build.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about a system or process they described publicly.",
      benefit:
        "An audit maps your workflows and hands you a ranked fix list with a 30-day follow-up, from $299 personal and $2,500 for a team.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} Best first offer for a cold business lead — small, concrete, no call.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "tailored_intelligence_server",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "A server built around your workflows, deployed and then kept running by us.",
    priceNote:
      "$499 – $4,500 for an individual, $5,000 – $100,000+ for a business. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Build-in-public. Post the architecture of one real build — discovery, custom build, roadmap — as three slides, and say what it replaced.",
      proof: "A real deployed server, redacted.",
      cta: "One link: start a request.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. Highest ceiling, so marketing warms it and outreach closes it.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about the specific bottleneck they named.",
      benefit:
        "We build an intelligence server around your workflows and keep it running, from $499 personal and $5,000 for a business.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} Never lead with the top of the range.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "team_intelligence_training_and_onboarding",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Role-by-role training so the tools you already bought actually get used.",
    priceNote: "$2,500 – $8,500. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "The unused-licence problem. Show one role's training path end to end and what that role can do at the end of it.",
      proof: "A real training path.",
      cta: "One link: see the training programmes.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about the team or the rollout they posted about.",
      benefit:
        "We run role-based training so the AI tools your team already has get used, from $2,500.",
      link: `${NI_LINK}/services`,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "workflow_integration_and_automation",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "The manual handoffs between your tools removed, permanently.",
    priceNote: "$4,500 – $15,000. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Count the manual handoffs in one real process on screen, then show the same process with zero. Numbers, not adjectives.",
      proof: "The real before and after.",
      cta: "One link: get your handoffs mapped.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow.",
      notes: `${DPMO_HASHTAG_RULE} Pairs naturally with the audit as the follow-on.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about the specific handoff or copy-paste step they complained about.",
      benefit:
        "We connect your tools and delete the manual handoffs between them, from $4,500.",
      link: `${NI_LINK}/services`,
      notes: DPMO_FOUNDATION_RULE,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "ai_governance_and_compliance_framework",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Written AI policy plus the monitoring that proves you are following it.",
    priceNote: "$8,000 – $25,000. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Publish the framework's table of contents and one real monitoring screen. Sober, plain, no fear-selling.",
      proof: "A real framework, redacted.",
      cta: "One link: see the framework.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. LinkedIn-weighted.",
      notes: `${DPMO_HASHTAG_RULE} Never claim legal or regulatory certification. Never name a regulator as an endorser.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about the policy or governance point they raised publicly.",
      benefit:
        "We write your AI policy and stand up the monitoring that evidences it, from $8,000.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} No fear-based framing and no implied liability advice.`,
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "enterprise_ai_strategy",
    sector: "services",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "One adoption plan for the whole organisation, sequenced and costed.",
    priceNote: "$12,000 – $35,000. Verified on northsideintelligence.com/services 2026-07-28.",
    marketing: {
      angle:
        "Show the shape of a real strategy deliverable — sequencing, dependencies, cost per phase — without naming a client.",
      proof: "A real redacted plan.",
      cta: "One link: start a strategy request.",
      link: `${NI_LINK}/services`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. LinkedIn-weighted.",
      notes: `${DPMO_HASHTAG_RULE} Highest price on the portal — marketing builds credibility, it never quotes.`,
    },
    outreach: {
      channel: "linkedin_dm",
      opener: "One true line about their stated adoption plan or the constraint they named.",
      benefit:
        "We build the organisation-wide AI adoption plan — sequenced, costed, with owners — from $12,000.",
      link: `${NI_LINK}/services`,
      notes: `${DPMO_FOUNDATION_RULE} Enterprise audience. Still no call.`,
    },
  },

  /* ================================================================ */
  /* SUBSCRIPTION PLANS — portal-wide. Marketing surfaces, never a     */
  /* person-to-person pitch. Outreach eligibility is OFF for all four. */
  /* ================================================================ */
  {
    ventureSlug: NI,
    offeringSlug: "plan_free",
    sector: "3",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Try every tool with limited monthly usage, no card.",
    priceNote: "$0/month. Verified on northsideintelligence.com 2026-07-28.",
    marketing: {
      angle:
        "The free plan IS the funnel. One post per tool showing the free cap being used for something real and useful.",
      proof: "The live free tier.",
      cta: "One link: start free.",
      link: `${NI_LINK}/auth/signup`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. This is the default CTA behind every Sector 3 post.",
      notes: `${DPMO_HASHTAG_RULE} Never put a price in a free-plan post.`,
    },
    outreach: {
      channel: "none",
      opener: "Not outreach-eligible. The free plan is reached through content and the product, never a DM.",
      benefit: "Try every tool free with limited monthly usage.",
      link: `${NI_LINK}/auth/signup`,
      notes: "Parked skeleton. Outreach eligibility is OFF at the taxonomy layer.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "plan_core",
    sector: "3",
    phase: "phase_2",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Three tools with unlimited usage.",
    priceNote: "$20/month, or $13/month billed annually ($159/year). 3 tool slots. Verified 2026-07-28.",
    marketing: {
      angle:
        "The arithmetic post. Two tools bought separately cost more than Core. Show the actual numbers from the portal.",
      proof: "The live pricing page.",
      cta: "One link: compare the plans.",
      link: `${NI_LINK}/subscriptions`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. Phase 2 — this is a retain-and-scale message, not a first-revenue one.",
      notes: `${DPMO_HASHTAG_RULE} Prices must be re-read from the portal before any post goes out.`,
    },
    outreach: {
      channel: "none",
      opener: "Not outreach-eligible. Plan upgrades happen in-app at the usage cap, never in a DM.",
      benefit: "Three tools with unlimited usage for $20 a month, or $13 a month billed annually.",
      link: `${NI_LINK}/subscriptions`,
      notes: "Parked skeleton. The in-app nudges on the five tools already point here.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "plan_pro",
    sector: "3",
    phase: "phase_2",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Ten tools with unlimited usage.",
    priceNote: "$39/month, or $27/month billed annually ($324/year). 10 tool slots. Verified 2026-07-28.",
    marketing: {
      angle: "Show a real ten-tool stack running one working day end to end.",
      proof: "The live toolkit screen.",
      cta: "One link: compare the plans.",
      link: `${NI_LINK}/subscriptions`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. Phase 2.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "none",
      opener: "Not outreach-eligible. In-app upgrade path only.",
      benefit: "Ten tools with unlimited usage for $39 a month, or $27 a month billed annually.",
      link: `${NI_LINK}/subscriptions`,
      notes: "Parked skeleton.",
    },
  },
  {
    ventureSlug: NI,
    offeringSlug: "plan_power",
    sector: "3",
    phase: "phase_2",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Every tool, unlimited, no slots to manage.",
    priceNote: "$59/month, or $47/month billed annually ($559/year). Unlimited tool slots. Verified 2026-07-28.",
    marketing: {
      angle:
        "The stop-counting post. Show slot management disappearing — no picking, no swapping, everything on.",
      proof: "The live unlimited toolkit.",
      cta: "One link: compare the plans.",
      link: `${NI_LINK}/subscriptions`,
      channels: NI_CHANNELS,
      cadence: "NI Marketing workflow. Phase 2, retention-weighted.",
      notes: DPMO_HASHTAG_RULE,
    },
    outreach: {
      channel: "none",
      opener: "Not outreach-eligible. In-app upgrade path only.",
      benefit: "Every tool, unlimited, for $59 a month or $47 a month billed annually.",
      link: `${NI_LINK}/subscriptions`,
      notes: "Parked skeleton.",
    },
  },

  /* ================================================================ */
  /* SECTOR 4 — Smart Store. Orders, not signups. 100% content-pull.   */
  /* Outreach nearly off: creator seeding only.                        */
  /* ================================================================ */
  {
    ventureSlug: NI,
    offeringSlug: "smart_store",
    sector: "4",
    phase: "phase_1",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "A daily curated shortlist with the price comparison already done.",
    priceNote:
      "Per-product pricing from the live store catalogue at northsideintelligence.com/store. Never quote a product price from memory — read the catalogue at post time.",
    marketing: {
      angle:
        "Viral organic content is the engine. Three repeatable formats: the price-comparison reel, the theme drop, and the daily viral pick. Show the product doing the thing, never a spec list.",
      proof: "The real product and the real live price on the store page.",
      cta: "One link: the store.",
      link: `${NI_LINK}/store`,
      channels: ["Instagram", "TikTok", "Reddit"],
      cadence:
        "NI Marketing workflow. Highest volume of any sector — the store is fed by content, not by selling.",
      notes: `${DPMO_HASHTAG_RULE} Never post a price that was not read from the live catalogue that day. Retention is Kit email flows, not DMs.`,
    },
    outreach: {
      channel: "none",
      opener:
        "Not outreach-eligible. The only person-to-person motion Sector 4 ever gets is creator and UGC seeding, and that is a JB-approved action, not an automated batch.",
      benefit: "A daily curated shortlist with the price comparison already done.",
      link: `${NI_LINK}/store`,
      notes:
        "JB approves content only and never sells anyone. If creator seeding is ever turned on it leaves the building and needs his approval per message.",
    },
  },

  /* ================================================================ */
  /* SECTOR 5 — AXON. Waitlist only. OUTREACH OFF, permanently for now.*/
  /* ================================================================ */
  {
    ventureSlug: NI,
    offeringSlug: "axon_waitlist",
    sector: "5",
    phase: "phase_0",
    marketingEnabled: false,
    outreachEnabled: false,
    benefitLine: "Early access to a personal AI operating system that learns one person, with your data kept in your own vault.",
    priceNote: "No price. Waitlist only — nothing is sold on this surface today.",
    marketing: {
      angle:
        "Build-in-public thought leadership. Post what is actually being built and the principles behind it: individual learning rather than one model for everyone, a private vault, written consent before any training use, and a published morality code that outranks profit. One CTA, always the same.",
      proof: "The live AXON page and the published morality code. Nothing that is not on the page.",
      cta: "One link: join the waitlist.",
      link: `${NI_LINK}/axon`,
      channels: ["LinkedIn", "Reddit"],
      cadence:
        "NI Marketing workflow. This is the missing revenue asset — the waitlist is the only thing being built right now.",
      notes: `${AXON_LANGUAGE_GUARDRAIL} Also never claim a medical, diagnostic or therapeutic benefit — the live page carries that disclaimer and the content must match it. ${DPMO_HASHTAG_RULE}`,
    },
    outreach: {
      channel: "none",
      opener:
        "OUTREACH IS OFF FOR SECTOR 5. No DM, no email, no comment, no connect request for AXON. Eligibility is OFF at the taxonomy layer so the live switch alone cannot start it.",
      benefit: "Early access to a personal AI operating system that learns one person.",
      link: `${NI_LINK}/axon`,
      notes: `${AXON_LANGUAGE_GUARDRAIL} At white-label launch this flips to a normal Phase 1 DPMO — waitlist to founding users. Not before, and not without JB.`,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Sector shapes — including sectors with no live offering yet.         */
/* Kept so a new offering inherits the right shape on day one.          */
/* ------------------------------------------------------------------ */

export type DpmoSectorShape = {
  sector: string;
  displayName: string;
  marketingShape: string;
  outreachShape: string;
  jbInvolvement: string;
  /** Does the sector shape allow cold person-to-person outreach at all? */
  coldOutreachAllowed: boolean;
  /** Live offerings carrying this shape today. */
  liveOfferings: number;
};

/**
 * THE SIX SUPPORT FACTS every skeleton must record, on top of the copy itself.
 *
 * `phase`, `channels` and `cta` already live on the two skeletons above. The
 * remaining three — LEAD SOURCE (separately per skeleton, never blended), the
 * PHASE 1 -> 2 TRIGGER, and JB's INVOLVEMENT LEVEL — are resolved here.
 *
 * They are stored per offering in `venture_offering_dpmo`, because an agent
 * asking "what is the outreach skeleton for offering X" must get one row and be
 * done. They are AUTHORED per sector, because the sector's autonomy is what
 * actually decides them — `more autonomous = more automated = less JB`.
 * Anything a sector default gets wrong is fixed in `DPMO_SUPPORT_OVERRIDES`.
 */
export type DpmoSupportFacts = {
  /** Where the MARKETING skeleton gets attention. Never blended with outreach. */
  marketingLeadSource: string;
  /** Where the OUTREACH skeleton gets people. Never blended with marketing. */
  outreachLeadSource: string;
  /** The observable event that flips Phase 1 -> Phase 2. Never a date. */
  phaseSwitchTrigger: string;
  /** How much JB touches this offering. */
  jbInvolvement: string;
  /**
   * Set ONLY where live reality contradicts the 6-Sector Master doc. Names the
   * stale row, dates both sides, and says which one this DPMO follows. Null
   * everywhere the master doc and reality already agree.
   */
  sectorReconciliation: string | null;
};

export const DPMO_SECTOR_SHAPES: DpmoSectorShape[] = [
  {
    sector: "1A",
    displayName: "Standalone brand — Match Fit",
    marketingShape: "Owns its full brand voice, channels and signup surface. Runs solo.",
    outreachShape: "Direct and approval-gated. Highest personal touch of any sector, and still no call.",
    jbInvolvement: "Highest",
    coldOutreachAllowed: true,
    liveOfferings: 4,
  },
  {
    sector: "1B",
    displayName: "Shared-lab umbrella — NI Labs",
    marketingShape: "Umbrella brand with cross-promotion between products. Content-led, freemium consumer angle.",
    outreachShape: "Light and mostly content-driven. Community seeding, never a one-to-one grind.",
    jbInvolvement: "Low",
    coldOutreachAllowed: true,
    liveOfferings: 0,
  },
  {
    sector: "2",
    displayName: "Pre-launch audience — Education & Services",
    marketingShape: "Content-first authority plus list capture. One CTA: join the list. No offer, no price.",
    outreachShape: "Basically off. A waitlist drip warms the list and nothing else.",
    jbInvolvement: "Low",
    coldOutreachAllowed: false,
    liveOfferings: 0,
  },
  {
    sector: "3",
    displayName: "Product-led, free-first — the five intelligence tools and the plans",
    marketingShape: "Free plan plus short demo clips. The product is the marketing. One CTA to the free signup.",
    outreachShape: "Minimal cold. The real selling is the in-app upgrade nudge at the usage cap.",
    jbInvolvement: "Near zero",
    coldOutreachAllowed: true,
    liveOfferings: 9,
  },
  {
    sector: "4",
    displayName: "Content-commerce — Smart Store",
    marketingShape: "Viral organic content is the engine. One CTA to the store link.",
    outreachShape: "Nearly off. Creator and UGC seeding only, and only with JB's approval per message.",
    jbInvolvement: "Content approval only — never sells anyone",
    coldOutreachAllowed: false,
    liveOfferings: 1,
  },
  {
    sector: "5",
    displayName: "Operator layer — AXON",
    marketingShape: "Build-in-public thought leadership. One CTA: join the waitlist.",
    outreachShape: "OFF. No DM, no email, no comment, no connect request.",
    jbInvolvement: "None outbound",
    coldOutreachAllowed: false,
    liveOfferings: 1,
  },
  {
    sector: "services",
    displayName: "NI Services — done-for-you projects",
    marketingShape: "Show the deliverable. Marketing warms, it never quotes.",
    outreachShape: "The main NI outreach lane. Half of every batch is web design.",
    jbInvolvement: "Approves every line before it sends",
    coldOutreachAllowed: true,
    liveOfferings: 11,
  },
];

/** Every offering in the seed has a DPMO with both live switches off. */
export function dpmoDefaultsAreAllOff(): boolean {
  return OFFERING_DPMO_SEED.every((d) => !d.marketingEnabled && !d.outreachEnabled);
}

/* ------------------------------------------------------------------ */
/* THE SUPPORT FACTS — lead source, phase trigger, JB involvement.      */
/* Authored per sector (autonomy decides them), overridden per offering.*/
/* ------------------------------------------------------------------ */

/**
 * SECTOR 2 RECONCILIATION — the one place the master doc and reality disagree.
 *
 * The 6-Sector Master (2026-07-22) files Education AND Services together under
 * "Sector 2 — Pre-Launch Audience DPMO, Fall 2026, not active", with outreach
 * "basically off" and Phase 0 audience-building only.
 *
 * That is half stale. On 2026-07-28 NI Services outreach is LIVE: 20 email
 * leads in the pipeline, 13 of them Custom Web Design and Management, and all
 * 11 services published with prices on the live portal.
 *
 * Reality wins, and the stale half is superseded EXPLICITLY rather than quietly
 * overwritten: Services moves to its own `services` shape running a live
 * Phase 1 outreach skeleton, while the Sector 2 pre-launch shape is KEPT
 * because it still correctly describes Education, which has no live offering.
 */
export const SECTOR_2_RECONCILIATION =
  'SUPERSEDES the 6-Sector Master row "Sector 2 — Pre-Launch Audience DPMO ' +
  '(Education & Services, Fall 2026, not active)" dated 2026-07-22, which says ' +
  'services outreach is "basically off" and Phase 0 audience-building only. ' +
  "REALITY on 2026-07-28: NI Services outreach is LIVE — 20 email leads in the " +
  "pipeline, 13 of them Custom Web Design and Management, and all 11 services " +
  "are published with prices on the live portal. This DPMO follows reality and " +
  "runs a live Phase 1 outreach skeleton. The Sector 2 pre-launch shape is NOT " +
  "deleted: it still correctly describes EDUCATION, which has no live offering. " +
  "Only the Services half of that row is stale.";

/** Support facts by sector. A new sector is data, never a migration. */
export const DPMO_SECTOR_SUPPORT: Record<string, DpmoSupportFacts> = {
  "1A": {
    marketingLeadSource:
      "Match Fit Admin Portal Content Calendar. Daily video, static and carousel across Facebook, Threads, Instagram and TikTok. Nationwide — no city, no region, no map.",
    outreachLeadSource:
      "Match Fit Outreach HQ. Five Instagram and five email leads per day, JB edits each piece of text, JB approves, then the per-lead sequence runs: DM, follow, like the three most recent posts by date, comment on a confirmed post.",
    phaseSwitchTrigger:
      "Flips to Phase 2 when enough coaches are listed for clients to reliably match — the two-sided marketplace is seeded. Referral and retention then replace acquisition.",
    jbInvolvement:
      "Highest of any sector. He edits every line and approves every send and every post. Still no phone call.",
    sectorReconciliation: null,
  },
  "3": {
    marketingLeadSource:
      "Short demo clips and the free plan itself. The product is the marketing — viewers land on the tool page and sign up free. No list, no cold source.",
    outreachLeadSource:
      "In-app only: existing free users who have hit the monthly usage cap. There is no cold list for this tool.",
    phaseSwitchTrigger:
      "Flips to Phase 2 when this tool has its first paying subscribers AND free users are repeatedly hitting the monthly cap. Content then moves from demo to depth and retention.",
    jbInvolvement:
      "Near zero. He approves the content batch and never sells anyone. The upgrade nudge runs without him.",
    sectorReconciliation: null,
  },
  "4": {
    marketingLeadSource:
      "Viral organic content is the entire engine — reels, price-comparison clips, theme drops and deal communities. Viewers go straight to the store link. This is a store with orders, not signups.",
    outreachLeadSource:
      'Nearly off. Creator and UGC seeding only ("free unit for a post?"), and only with JB approving each message. Never a cold buyer DM.',
    phaseSwitchTrigger:
      "Flips to Phase 2 when repeat buyers appear. Kit email flows — browse, cart, post-purchase, repeat-buyer bundles — then take over from pure acquisition content.",
    jbInvolvement: "Content approval only. He never sells anyone.",
    sectorReconciliation: null,
  },
  "5": {
    // The AXON language guardrail lives in `marketing.notes`, not here — a lead
    // source is not the place for banned wording, and repeating the banned
    // terms in a field a writer copies from is how they leak into copy.
    marketingLeadSource:
      "Build-in-public thought leadership. Readers of what is actually being built join the waitlist. One CTA, one link, no price. Language guardrails live in the marketing notes and are absolute.",
    outreachLeadSource:
      "NONE. Outreach is OFF for AXON — no DM, no email, no comment, no connect request. There is no lead source because there is no outreach.",
    phaseSwitchTrigger:
      "Stays at Phase 0 (waitlist, nothing sold) until the white-label launch. Phase 1 begins only when the waitlist converts to founding users — a launch event, never a date.",
    jbInvolvement: "None outbound. He approves build-in-public posts; nothing reaches a person.",
    sectorReconciliation: null,
  },
  services: {
    marketingLeadSource:
      "NI Content Machine daily posts on LinkedIn, Reddit and Instagram. Marketing shows the deliverable and warms the audience — it never quotes a price and never asks for the sale.",
    outreachLeadSource:
      "NI Outreach HQ. Five email and five LinkedIn leads generated per day, JB edits every line, JB approves before anything sends. At least half of every batch is Custom Web Design and Management.",
    phaseSwitchTrigger:
      "Flips to Phase 2 when this service has delivered its first paid project and a real named case study exists. Marketing then leads with that proof and outreach volume drops.",
    jbInvolvement:
      "Highest of the NI sectors. He approves every outreach line before it sends and approves every post before it goes up. Still no phone call, ever.",
    sectorReconciliation: SECTOR_2_RECONCILIATION,
  },
};

/**
 * Per-offering corrections where the sector default is wrong. Keyed
 * `ventureSlug/offeringSlug`. Partial — anything omitted falls back to the
 * sector.
 */
export const DPMO_SUPPORT_OVERRIDES: Record<string, Partial<DpmoSupportFacts>> = {
  // ReplyFlow is the ONE intelligence tool with a person-to-person lane, so the
  // sector default ("in-app only") would be wrong for it.
  [`${NI}/replyflow`]: {
    outreachLeadSource:
      "Two sources, kept separate. Primary: in-app nudges to existing free users who have hit the 10-reply monthly cap — this is where the real selling happens. Secondary: NI Outreach HQ carries ReplyFlow as the one intelligence tool eligible for a person-to-person lane (1 live email lead on 2026-07-28); JB edits and approves every line. The other four tools have no cold lane at all.",
  },
  // The plans sit in Sector 3 but are a retention surface, not a tool.
  ...Object.fromEntries(
    ["plan_free", "plan_core", "plan_pro", "plan_power"].map((slug) => [
      `${NI}/${slug}`,
      {
        marketingLeadSource:
          "Portal visitors and existing free users. The plan is shown as arithmetic against buying tools one at a time.",
        outreachLeadSource:
          "None. Plans are never pitched person-to-person — the in-app upgrade nudge does this work.",
        phaseSwitchTrigger:
          "The Free plan is the Phase 1 entry point; Core, Pro and Power are already Phase 2 — they exist to retain and scale users who arrived through a free tool.",
        jbInvolvement: "Near zero. No approval needed per user; the nudge is automated.",
      } satisfies Partial<DpmoSupportFacts>,
    ]),
  ),
  // Match Fit clients are never cold-contacted.
  [`${MF}/client_vip`]: {
    outreachLeadSource:
      "None. Clients are never cold-contacted — they arrive through marketing content and the app itself.",
  },
};

/**
 * The six support facts for one offering: sector shape, then any per-offering
 * override. This is what gets written to the row an agent reads.
 */
export function resolveDpmoSupport(dpmo: {
  ventureSlug: string;
  offeringSlug: string;
  sector: string;
}): DpmoSupportFacts {
  const base = DPMO_SECTOR_SUPPORT[dpmo.sector];
  if (!base) {
    throw new Error(
      `No DPMO support facts for sector "${dpmo.sector}". Add it to DPMO_SECTOR_SUPPORT.`,
    );
  }
  return { ...base, ...DPMO_SUPPORT_OVERRIDES[`${dpmo.ventureSlug}/${dpmo.offeringSlug}`] };
}

/** Every offering has resolvable support facts, and no skeleton shares a lead source. */
export function dpmoSupportProblems(): string[] {
  const problems: string[] = [];
  for (const d of OFFERING_DPMO_SEED) {
    let s: DpmoSupportFacts;
    try {
      s = resolveDpmoSupport(d);
    } catch (e) {
      problems.push((e as Error).message);
      continue;
    }
    for (const [field, value] of Object.entries(s)) {
      if (field === "sectorReconciliation") continue;
      if (!value || !String(value).trim()) {
        problems.push(`${d.ventureSlug}/${d.offeringSlug}: "${field}" is empty.`);
      }
    }
    // Marketing and outreach are separate objects and must never share a source.
    if (s.marketingLeadSource === s.outreachLeadSource) {
      problems.push(
        `${d.ventureSlug}/${d.offeringSlug}: marketing and outreach must not share a lead source.`,
      );
    }
  }
  return problems;
}
