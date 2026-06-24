/**
 * Match Fit social content calendar — canonical schedule for agents and the admin portal.
 * Audiences: Join the Team | List With Us | Clients (no Atlanta/virtual marketing split).
 */

export const MATCHFIT_CONTENT_AUDIENCES = ["Join the Team", "List With Us", "Clients"] as const;

export const MATCHFIT_CONTENT_AUDIENCE_DESCRIPTIONS = {
  "Join the Team": "Trainers looking to become a Match Fit Fitness Pro",
  "List With Us": "Independent trainers & facilities using Match Fit as a listing/discovery platform",
  Clients: "Athletes and individuals looking for training",
};

export const MATCHFIT_CONTENT_RULES = {
  maxHashtags: 5,
  repurposeCharLimit: 500,
  fitnessProLanguage: 'Always say "Fitness Pros" — never trainers or personal trainers in marketing copy.',
  geography: "Do not lead with Atlanta or local geography. In-person is Atlanta-only operationally, not a campaign hook.",
};

/** M–F rotation: post type → audience (alternates by weekday). */
export const MATCHFIT_WEEKLY_ROTATION = {
  baseline: {
    Carousel: "Join the Team",
    Static: "List With Us",
    Video: "Clients",
    Text: "Join the Team",
  },
  note: "Offset rotates audiences each weekday across Join the Team, List With Us, and Clients.",
};

export const MATCHFIT_CONTENT_PILLARS = [
  "Fitness Pro recruitment",
  "Listing & discovery for independent pros and facilities",
  "Client pain points & outcomes",
  "How Match Fit works",
  "Fit Hub & product features",
  "Founding beta / promos (align with /promos scan)",
  "Social proof",
];

export const MATCHFIT_PLATFORM_NOTES = {
  Carousel: "Instagram, Threads, Facebook, TikTok — caption + visual prompt",
  Static: "Instagram, Threads, Facebook — caption + visual prompt",
  Video: "Reels / TikTok — caption + video prompt (editable in Content Hub)",
  Text: "Threads, Facebook — caption only, no visual prompt",
};

const matchfitContentCalendar = {
  audiences: MATCHFIT_CONTENT_AUDIENCES,
  audienceDescriptions: MATCHFIT_CONTENT_AUDIENCE_DESCRIPTIONS,
  rules: MATCHFIT_CONTENT_RULES,
  rotation: MATCHFIT_WEEKLY_ROTATION,
  pillars: MATCHFIT_CONTENT_PILLARS,
  platforms: MATCHFIT_PLATFORM_NOTES,
};

export default matchfitContentCalendar;
