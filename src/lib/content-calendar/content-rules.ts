import type { ContentCalendarGroup } from "@/lib/content-calendar/constants";
import { CONTENT_CALENDAR_GROUPS } from "@/lib/content-calendar/constants";
import { HIGH_VOLUME_HASHTAG_RULE, enforceHighVolumeHashtags } from "@/lib/content-calendar/hashtag-policy";

/** Repurpose-safe limit: smallest caption budget across Match Fit platforms (Threads). */
export const CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT = 500;

export const CONTENT_CALENDAR_MAX_HASHTAGS = 5;

/** Canonical Fitness Pro signup URL for social CTAs (hyphenated path). */
export const MATCH_FIT_COACH_SIGNUP_URL = "match-fit.net/trainer/sign-up";

/** Canonical client signup URL for social CTAs. */
export const MATCH_FIT_CLIENT_SIGNUP_URL = "match-fit.net/client/sign-up";

/**
 * Legacy audience labels stored before the three-audience split. Read-only
 * back-compat for historic rows: these map old geo-flavoured labels ONTO the
 * neutral audiences. Nothing new is ever written with these keys.
 */
const LEGACY_GROUP_MAP: Record<string, ContentCalendarGroup> = {
  "Atlanta Trainers": "Join the Team", // geo-guard:allow — historic stored label, mapped away
  "Virtual Trainers": "Join the Team",
  "Atlanta Clients": "Clients", // geo-guard:allow — historic stored label, mapped away
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
  targetGroup?: ContentCalendarGroup | string;
}): { caption: string; hashtags: string[]; charCount: number; withinLimit: boolean } {
  // Generated content must obey JB's locked high-volume hashtag rule. This is the
  // single choke point every generation path funnels through, so enforcing here
  // catches the AI paths and the static fallbacks alike. Operator edits are NOT
  // coerced (see normalizeUserEditedPostContent) — a human typing a tag wins.
  const hashtags = normalizeHashtags(
    enforceHighVolumeHashtags(args.hashtags, {
      group: args.targetGroup,
      max: CONTENT_CALENDAR_MAX_HASHTAGS,
    })
  );
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
 * Fitness Pro root CTAs → match-fit.net/trainer/sign-up (never invent audience-labeled paths).
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
 * Social marketing copy should say Fitness Pro(s) (canonical label — CLAUDE.md Product Copy)
 * — not Coaches. Never rewrite protected /trainer/... URL path segments during language swaps.
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
    .replace(/\bMatch Fit Coaches\b/gi, "Match Fit Fitness Pros")
    .replace(/\bMatch Fit Coach\b/gi, "Match Fit Fitness Pro")
    .replace(/\bFit Pros\b/gi, "Fitness Pros")
    .replace(/\bFit Pro\b/gi, "Fitness Pro")
    .replace(/\bCoaches\b/gi, "Fitness Pros")
    .replace(/\bCoach\b/gi, "Fitness Pro");

  out = out.replace(/\u0000URL(\d+)\u0000/g, (_, index: string) => protectedSegments[Number(index)] ?? "");
  return canonicalizeSocialSignupUrls(out);
}

/** @deprecated Use normalizeCoachLanguage — kept for older imports. */
export const normalizeFitnessProLanguage = normalizeCoachLanguage;

/** True when social copy still contains the retired public audience label ("Coach"/"Coaches"). */
export function hasForbiddenSocialAudienceLabel(text: string): boolean {
  return /\bCoach(?:es)?\b/i.test(text);
}

/** True when social copy still has a broken / non-canonical Fitness Pro signup path. */
export function hasBrokenSocialSignupUrl(text: string): boolean {
  if (/match-fit\.net\/(?:Fitness\s*Pros?|fitness[-_]?pros?|coach(?:es)?)\/sign/i.test(text)) {
    return true;
  }
  // Root Fitness Pro CTA must use hyphenated /sign-up after enforcement.
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

export const CONTENT_CALENDAR_FOUNDING_PROMO_FACTS = `Founding Fitness Pro promo (social — exact meaning required; wording MUST vary every post):
1) First 30 Fitness Pros get 60 days of Premium access free — use all Match Fit tools and maximize opportunity.
2) First 10 Fitness Pros get onboarding fees waived completely.
Keep the facts accurate. Never invent other caps or swap the numbers. Never paste the same promo sentence twice in a batch — rotate phrasing while preserving meaning.`;

export const CONTENT_CALENDAR_AI_RULES = `Content rules (strict):
- Target audiences: only "Join the Team", "List With Us", or "Clients" — never a geographic or virtual/in-person split in copy.
- "Join the Team" = Fitness Pros exploring Match Fit recruitment / onboarding.
- "List With Us" = independent Fitness Pros & facilities using Match Fit as a listing/discovery platform.
- "Clients" = athletes and individuals looking for training.
- Do NOT name any city, metro, state or country in captions. Match Fit is worldwide; geography is never a marketing hook.
- Always say "Fitness Pros" / "Fitness Pro" in social copy (never "Coaches" or "coach" as the primary public label).
- Canonical signup URLs only (never invent paths):
  - Fitness Pro / Join the Team / List With Us CTAs → ${MATCH_FIT_COACH_SIGNUP_URL}
  - Client CTAs → ${MATCH_FIT_CLIENT_SIGNUP_URL}
  - Never write match-fit.net/Fitness Pro/signup, match-fit.net/fitness-pro/signup, match-fit.net/coach/signup, or match-fit.net/trainer/signup (use /trainer/sign-up).
- Carousel captions must follow the same shape as Static captions (hook → insight → payoff → CTA). Never describe slides in the caption.
- ${CONTENT_CALENDAR_FOUNDING_PROMO_FACTS}
- Maximum ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags per post (no # prefix in JSON array).
${HIGH_VOLUME_HASHTAG_RULE}
- Caption + hashtags combined must stay within ${CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT} characters (Threads repurpose limit).
- Align offers and urgency with live site/promo scan context when provided — do not invent caps or pricing beyond the locked founding facts above.
- Never publish placeholder copy that only names post type, audience, or brand hex colors.`;
