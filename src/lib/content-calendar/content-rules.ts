import type { ContentCalendarGroup } from "@/lib/content-calendar/constants";
import { CONTENT_CALENDAR_GROUPS } from "@/lib/content-calendar/constants";

/** Repurpose-safe limit: smallest caption budget across Match Fit platforms (Threads). */
export const CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT = 500;

export const CONTENT_CALENDAR_MAX_HASHTAGS = 5;

/** Canonical coach signup URL for social CTAs (hyphenated path). */
export const MATCH_FIT_COACH_SIGNUP_URL = "match-fit.net/trainer/sign-up";

/** Canonical client signup URL for social CTAs. */
export const MATCH_FIT_CLIENT_SIGNUP_URL = "match-fit.net/client/sign-up";

/** Legacy audience labels stored before the three-audience split. */
const LEGACY_GROUP_MAP: Record<string, ContentCalendarGroup> = {
  "Atlanta Trainers": "Join the Team",
  "Virtual Trainers": "Join the Team",
  "Atlanta Clients": "Clients",
  "Virtual Clients": "Clients",
  "Fitness Pros": "Join the Team",
};

export function normalizeTargetGroup(group: string): ContentCalendarGroup {
  if ((CONTENT_CALENDAR_GROUPS as readonly string[]).includes(group)) {
    return group as ContentCalendarGroup;
  }
  return LEGACY_GROUP_MAP[group] ?? "Join the Team";
}

export function normalizeHashtags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = String(raw).replace(/^#/, "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= CONTENT_CALENDAR_MAX_HASHTAGS) break;
  }
  return out;
}

export function formatHashtagsForPost(tags: string[]): string {
  return normalizeHashtags(tags)
    .map((t) => `#${t}`)
    .join(" ");
}

export function repurposePostLength(caption: string, hashtags: string[]): number {
  const tags = formatHashtagsForPost(hashtags);
  if (!tags) return caption.trim().length;
  return `${caption.trim()}\n\n${tags}`.length;
}

/** Trim caption so caption + hashtags fit the repurpose character limit. */
export function fitCaptionForRepurpose(caption: string, hashtags: string[]): string {
  const tags = formatHashtagsForPost(hashtags);
  const suffix = tags ? `\n\n${tags}` : "";
  const maxCaption = CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT - suffix.length;
  const trimmed = caption.trim();
  if (trimmed.length <= maxCaption) return trimmed;
  if (maxCaption <= 3) return trimmed.slice(0, Math.max(0, maxCaption));
  return `${trimmed.slice(0, maxCaption - 1).trimEnd()}…`;
}

export function enforceGeneratedPostContent(args: {
  caption: string;
  hashtags: string[];
}): { caption: string; hashtags: string[]; charCount: number; withinLimit: boolean } {
  const hashtags = normalizeHashtags(args.hashtags);
  const caption = fitCaptionForRepurpose(normalizeCoachLanguage(args.caption), hashtags);
  const charCount = repurposePostLength(caption, hashtags);
  return {
    caption,
    hashtags,
    charCount,
    withinLimit: charCount <= CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  };
}

/** Operator edits: normalize language and hashtags but never truncate caption. */
export function normalizeUserEditedPostContent(args: {
  caption: string;
  hashtags: string[];
}): { caption: string; hashtags: string[]; charCount: number; withinLimit: boolean } {
  const hashtags = normalizeHashtags(args.hashtags);
  const caption = normalizeCoachLanguage(args.caption);
  const charCount = repurposePostLength(caption, hashtags);
  return {
    caption,
    hashtags,
    charCount,
    withinLimit: charCount <= CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  };
}

/**
 * Canonicalize social signup URLs.
 * Coach root CTAs → match-fit.net/trainer/sign-up (never invent audience-labeled paths).
 * Does not rewrite deeper signup flow paths like /trainer/signup/terms.
 */
export function canonicalizeSocialSignupUrls(text: string): string {
  return text
    .replace(
      /(?:https?:\/\/)?(?:www\.)?match-fit\.net\/(?:Fitness\s*Pros?|fitness[-_]?pros?|coach(?:es)?)\/sign-?up/gi,
      MATCH_FIT_COACH_SIGNUP_URL,
    )
    .replace(/\/(?:Fitness\s*Pros?|fitness[-_]?pros?|coach(?:es)?)\/sign-?up/gi, "/trainer/sign-up")
    .replace(
      /(?:https?:\/\/)?(?:www\.)?match-fit\.net\/trainer\/signup(?![/\w-])/gi,
      MATCH_FIT_COACH_SIGNUP_URL,
    )
    .replace(/\/trainer\/signup(?![/\w-])/gi, "/trainer/sign-up");
}

/**
 * Social marketing copy should say Coaches (wider audience) — not Fitness Pros / trainers.
 * Never rewrite protected /trainer/... URL path segments during language swaps.
 */
export function normalizeCoachLanguage(text: string): string {
  const protectedSegments: string[] = [];
  const withPlaceholders = text.replace(
    /(?:https?:\/\/)?(?:www\.)?match-fit\.net\/trainer(?:\/[\w\-./?#&=%]*)?|\/trainer(?:\/[\w\-./?#&=%]*)?/gi,
    (match) => {
      const idx = protectedSegments.length;
      protectedSegments.push(match);
      return `\u0000URL${idx}\u0000`;
    },
  );

  let out = withPlaceholders
    .replace(/\bMatch Fit Pros\b/gi, "Match Fit coaches")
    .replace(/\bMatch Fit Pro\b/gi, "Match Fit coach")
    .replace(/\bFitness Pros\b/gi, "Coaches")
    .replace(/\bFitness Pro\b/gi, "Coach")
    .replace(/\bFit Pros\b/gi, "coaches")
    .replace(/\bFit Pro\b/gi, "coach")
    .replace(/\bpersonal trainers\b/gi, "coaches")
    .replace(/\bpersonal trainer\b/gi, "coach")
    .replace(/\btrainers\b/gi, "coaches")
    .replace(/\btrainer\b/gi, "coach");

  out = out.replace(/\u0000URL(\d+)\u0000/g, (_, index: string) => protectedSegments[Number(index)] ?? "");
  return canonicalizeSocialSignupUrls(out);
}

/** @deprecated Use normalizeCoachLanguage — kept for older imports. */
export const normalizeFitnessProLanguage = normalizeCoachLanguage;

/** True when social copy still contains the retired public audience label. */
export function hasForbiddenSocialAudienceLabel(text: string): boolean {
  return /\bFitness\s+Pros?\b/i.test(text) || /\bFit\s+Pros?\b/i.test(text);
}

/** True when social copy still has a broken / non-canonical coach signup path. */
export function hasBrokenSocialSignupUrl(text: string): boolean {
  if (/match-fit\.net\/(?:Fitness\s*Pros?|fitness[-_]?pros?|coach(?:es)?)\/sign/i.test(text)) {
    return true;
  }
  // Root coach CTA must use hyphenated /sign-up after enforcement.
  if (/(?:https?:\/\/)?(?:www\.)?match-fit\.net\/trainer\/signup(?![/\w-])/i.test(text)) {
    return true;
  }
  return false;
}

/** Carousel captions that only inventory slides are not useful — reject. */
export function isSlideInventoryCarouselCaption(caption: string): boolean {
  const trimmed = caption.trim();
  if (!trimmed) return false;
  if (/(?:^|\n)\s*(?:slide|frame)\s*\d+\s*[:.\-–—]/im.test(trimmed)) return true;
  if (/\bslide\s*1\b[\s\S]{0,120}\bslide\s*2\b/i.test(trimmed)) return true;
  if (/\b(?:in this carousel|swipe through(?:\s+these)?\s+slides?)\b/i.test(trimmed)) return true;
  if (
    /\b(?:slides?|frames?)\s+(?:include|are|cover|show|teach)\b/i.test(trimmed) &&
    /(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+\S+/m.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export const CONTENT_CALENDAR_FOUNDING_PROMO_FACTS = `Founding coach promo (social — exact meaning required; wording MUST vary every post):
1) First 30 coaches get 60 days of Premium access free — use all Match Fit tools and maximize opportunity.
2) First 10 coaches get onboarding fees waived completely.
Keep the facts accurate. Never invent other caps or swap the numbers. Never paste the same promo sentence twice in a batch — rotate phrasing while preserving meaning.`;

export const CONTENT_CALENDAR_AI_RULES = `Content rules (strict):
- Target audiences: only "Join the Team", "List With Us", or "Clients" — never Atlanta/virtual split in copy.
- "Join the Team" = coaches exploring Match Fit recruitment / onboarding.
- "List With Us" = independent coaches & facilities using Match Fit as a listing/discovery platform.
- "Clients" = athletes and individuals looking for training.
- Do NOT market Atlanta or local geography in captions; in-person sessions are Atlanta-only operationally but not a marketing hook.
- Always say "Coaches" / "coach" in social copy (never "Fitness Pros", "Fitness Pro", "trainers", or "personal trainers" as the primary public label).
- Canonical signup URLs only (never invent paths):
  - Coach / Join the Team / List With Us CTAs → ${MATCH_FIT_COACH_SIGNUP_URL}
  - Client CTAs → ${MATCH_FIT_CLIENT_SIGNUP_URL}
  - Never write match-fit.net/Fitness Pro/signup, match-fit.net/fitness-pro/signup, match-fit.net/coach/signup, or match-fit.net/trainer/signup (use /trainer/sign-up).
- Carousel captions must follow the same shape as Static captions (hook → insight → payoff → CTA). Never describe slides in the caption.
- ${CONTENT_CALENDAR_FOUNDING_PROMO_FACTS}
- Maximum ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags per post (no # prefix in JSON array).
- Caption + hashtags combined must stay within ${CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT} characters (Threads repurpose limit).
- Align offers and urgency with live site/promo scan context when provided — do not invent caps or pricing beyond the locked founding facts above.
- Never publish placeholder copy that only names post type, audience, or brand hex colors.`;
