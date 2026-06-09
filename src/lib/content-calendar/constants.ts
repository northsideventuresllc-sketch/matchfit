export const CONTENT_CALENDAR_PLATFORMS_GEN = [
  "Instagram",
  "TikTok",
  "Facebook",
  "Threads",
  "LinkedIn",
] as const;

export const CONTENT_CALENDAR_CONTENT_TYPES = [
  "Trainer Recruitment",
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

export const CONTENT_CALENDAR_GROUPS = [
  "Atlanta Trainers",
  "Virtual Trainers",
  "Atlanta Clients",
  "Virtual Clients",
] as const;

export type ContentCalendarGroup = (typeof CONTENT_CALENDAR_GROUPS)[number];

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
export const CONTENT_CALENDAR_GENERATOR_POST_TYPES = ["Carousel", "Static", "Video"] as const;

export type ContentCalendarGeneratorPostType = (typeof CONTENT_CALENDAR_GENERATOR_POST_TYPES)[number];

export const CONTENT_CALENDAR_DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const CONTENT_CALENDAR_DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export const CONTENT_CALENDAR_BRAND_FACTS = `Match Fit — two-sided fitness marketplace connecting personal trainers with clients in Atlanta.
Beta v1.2+, Atlanta focus. Clients: $10/month. Trainer premium from $20/month. 20% platform fee on sessions.
Features: swipe-based discovery, Fit Hub social feed, AI matching, virtual + in-person.
Brand: bold, direct, real — no fluff. Colors: dark #07080C, orange #FF7E00. Handle: @theofficialmatchfit
Goal: grow beta trainers and clients. Site: match-fit.net`;
