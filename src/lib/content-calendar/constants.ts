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

export const CONTENT_CALENDAR_GROUPS = ["Join the Team", "List With Us", "Clients"] as const;

export type ContentCalendarGroup = (typeof CONTENT_CALENDAR_GROUPS)[number];

export const CONTENT_CALENDAR_GROUP_DESCRIPTIONS: Record<ContentCalendarGroup, string> = {
  "Join the Team": "Trainers looking to become a Match Fit Fitness Pro",
  "List With Us": "Independent trainers & facilities using Match Fit as a listing/discovery platform",
  Clients: "Athletes and individuals looking for training",
};

/** Max posts in one bulk generation run (shown in UI warning). */
export const CONTENT_CALENDAR_BULK_MAX_COUNT = 20;

export const CONTENT_CALENDAR_BULK_DEFAULT_PROMPT =
  "Use live website promos, social performance, and product features (Fit Hub, discovery matching, founding Fitness Pro offers, client VIP trial) to write specific hooks — never generic beta filler.";

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

export const CONTENT_CALENDAR_DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const CONTENT_CALENDAR_DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export const CONTENT_CALENDAR_BRAND_FACTS = `Match Fit — two-sided fitness marketplace connecting Fitness Pros with clients.
Beta v1.2+. Clients: $10/month. Fitness Pro premium from $20/month. 20% platform fee on sessions.
Features: swipe-based discovery, Fit Hub social feed, algorithmic matching, virtual + in-person (in-person launch limited to Atlanta operationally — do NOT lead marketing with geography).
Brand: bold, direct, real — no fluff. Colors: dark #07080C, orange #FF7E00. Handle: @theofficialmatchfit
Universal language: always "Fitness Pros" (never trainers/personal trainers/coaches as the primary label).
Target audiences (content calendar only): "Join the Team" (trainers becoming Match Fit Fitness Pros), "List With Us" (independent trainers & facilities using Match Fit for listing/discovery), "Clients" (athletes and individuals looking for training).
Goal: grow beta Fitness Pros and clients. Site: match-fit.net`;
