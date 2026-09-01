export const CONTENT_CALENDAR_PLATFORMS_GEN = [
  "Instagram",
  "TikTok",
  "Facebook",
  "Threads",
  "LinkedIn",
] as const;

export const CONTENT_CALENDAR_CONTENT_TYPES = [
  "Fitness Pro Recruitment",
  "Brand Awareness",
  "FitHub Feature",
  "Client Pain Point",
  "How It Works",
  "Social Proof",
] as const;

export const CONTENT_CALENDAR_TONES = [
  "Hype / Energetic",
  "Professional",
  "Conversational",
  "Bold / Direct",
] as const;

/** Brand palette — single source of truth for media generation prompts. */
export const MATCH_FIT_BRAND_DARK = "#07080C";
export const MATCH_FIT_BRAND_ORANGE = "#FF7E00";

/** Public path to the Match Fit logo; media prompts must reference it. */
export const MATCH_FIT_LOGO_PATH = "public/logo.png";

export const CONTENT_CALENDAR_GROUPS = ["Join the Team", "List With Us", "Clients"] as const;

export type ContentCalendarGroup = (typeof CONTENT_CALENDAR_GROUPS)[number];

export const CONTENT_CALENDAR_GROUP_DESCRIPTIONS: Record<ContentCalendarGroup, string> = {
  "Join the Team": "Fitness Pros looking to join Match Fit",
  "List With Us": "Independent Fitness Pros & facilities using Match Fit as a listing/discovery platform",
  Clients: "Athletes and individuals looking for training",
};

/** Max posts in one bulk generation run (shown in UI warning). */
export const CONTENT_CALENDAR_BULK_MAX_COUNT = 20;

export const CONTENT_CALENDAR_BULK_DEFAULT_PROMPT =
  "Use live website promos, social performance, and product features (Fit Hub, discovery matching, founding Fitness Pro offers — first 30 get 60 days Premium free; first 10 get onboarding fees waived — client VIP trial) to write specific hooks — never generic beta filler.";

/** Soft-deleted hub posts are permanently removed after this window. */
export const CONTENT_HUB_DELETE_RETENTION_HOURS = 48;

/** Posted hub posts stay visible in Recently Posted for this window, then auto-purge. */
export const CONTENT_HUB_POSTED_RETENTION_HOURS = 48;

export const CONTENT_CALENDAR_POST_TYPES = ["Carousel", "Static", "Video", "Text"] as const;

export type ContentCalendarPostType = (typeof CONTENT_CALENDAR_POST_TYPES)[number];

export const CONTENT_CALENDAR_TYPE_ICONS: Record<ContentCalendarPostType, string> = {
  Carousel: "◈",
  Static: "▣",
  Video: "▶",
  Text: "≡",
};

export const CONTENT_CALENDAR_PLATFORMS_BY_TYPE: Record<ContentCalendarPostType, string> = {
  Carousel: "Instagram, Threads, Facebook, TikTok",
  Static: "Instagram, Threads, Facebook",
  Video: "Instagram Reels, Facebook Reels, Threads, TikTok",
  Text: "Threads, Facebook",
};

/** Post types available in the AI generator (maps to platforms automatically). */
export const CONTENT_CALENDAR_GENERATOR_POST_TYPES = ["Carousel", "Static", "Video", "Text"] as const;

export type ContentCalendarGeneratorPostType = (typeof CONTENT_CALENDAR_GENERATOR_POST_TYPES)[number];

/** Mon / Wed / Fri — live Match Fit social posting days (America/New_York). */
export const CONTENT_CALENDAR_SOCIAL_POSTING_WEEKDAYS = [1, 3, 5] as const;

export const CONTENT_CALENDAR_SOCIAL_POSTING_CUTOFF_HOUR_EST = 17;

export const CONTENT_CALENDAR_DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const CONTENT_CALENDAR_DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

/**
 * JB-locked per-weekday post-type rotation (mirrors content/social/matchfit-content-calendar.jsx
 * MATCHFIT_WEEKLY_ROTATION.byWeekday): Mon/Wed/Fri carry Carousel + Video; Tue/Thu carry
 * Static + Text. Keyed by dayIndex 0=Mon..4=Fri, matching WeeklyDayPlan.dayIndex — NOT
 * JS Date.getDay() (0=Sun), which is what CONTENT_CALENDAR_SOCIAL_POSTING_WEEKDAYS uses.
 */
export const CONTENT_CALENDAR_WEEKDAY_POST_TYPES: Record<number, readonly ContentCalendarPostType[]> = {
  0: ["Carousel", "Video"], // Monday
  1: ["Static", "Text"], // Tuesday
  2: ["Carousel", "Video"], // Wednesday
  3: ["Static", "Text"], // Thursday
  4: ["Carousel", "Video"], // Friday
};

export const CONTENT_CALENDAR_BRAND_FACTS = `Match Fit — two-sided fitness marketplace connecting Fitness Pros with clients.
Beta v1.2+. Clients: $10/month. Independent Pro from $15/month after a 60-day free trial at registration. 20% platform fee on sessions.
Features: swipe-based discovery, Fit Hub social feed, algorithmic matching, virtual + in-person. Match Fit is worldwide — do NOT name a city, metro or region in marketing, and never imply a launch is limited to one place.

Brand: bold, direct, real — no fluff. Colors: dark #07080C, orange #FF7E00. Handle: @theofficialmatchfit
Universal social language: always "Fitness Pros" / "Fitness Pro" (never "Coaches" as the primary public label; "trainer" stays only for narrow allowed cases — assigned coach in a session, personal-training-industry positioning, service types, and /trainer/ routes).
Target audiences (content calendar only): "Join the Team" (Fitness Pros joining Match Fit), "List With Us" (independent Fitness Pros & facilities using Match Fit for listing/discovery), "Clients" (athletes and individuals looking for training).
Goal: grow beta Fitness Pros and clients. Site: match-fit.net
Canonical signup URLs: Fitness Pros join at match-fit.net/trainer/sign-up; clients join at match-fit.net/client/sign-up. Never use match-fit.net/Fitness Pro/signup or match-fit.net/trainer/signup in social copy.
Founding Fitness Pro promo (exact meaning; vary wording every time): first 30 Fitness Pros get 60 days of Premium access free (all tools / maximize opportunity); first 10 Fitness Pros get onboarding fees waived completely.`;
