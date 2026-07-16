import type { ContentCalendarGroup } from "@/lib/content-calendar/constants";
import { CONTENT_CALENDAR_GROUPS } from "@/lib/content-calendar/constants";

/** Repurpose-safe limit: smallest caption budget across Match Fit platforms (Threads). */
export const CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT = 500;

export const CONTENT_CALENDAR_MAX_HASHTAGS = 5;

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
  const caption = fitCaptionForRepurpose(normalizeFitnessProLanguage(args.caption), hashtags);
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
  const caption = normalizeFitnessProLanguage(args.caption);
  const charCount = repurposePostLength(caption, hashtags);
  return {
    caption,
    hashtags,
    charCount,
    withinLimit: charCount <= CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  };
}

/** Marketing copy should say Fitness Pros instead of trainer(s). Never rewrite /trainer URL paths. */
export function normalizeFitnessProLanguage(text: string): string {
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
    .replace(/\bpersonal trainers\b/gi, "Fitness Pros")
    .replace(/\bpersonal trainer\b/gi, "Fitness Pro")
    .replace(/\btrainers\b/gi, "Fitness Pros")
    .replace(/\btrainer\b/gi, "Fitness Pro");

  // Repair broken paths produced by earlier language normalization or AI inventing audience-labeled URLs.
  out = out
    .replace(/(?:https?:\/\/)?(?:www\.)?match-fit\.net\/Fitness\s*Pros?\/signup/gi, "match-fit.net/trainer/signup")
    .replace(/\/Fitness\s*Pros?\/signup/gi, "/trainer/signup");

  return out.replace(/\u0000URL(\d+)\u0000/g, (_, index: string) => protectedSegments[Number(index)] ?? "");
}

export const CONTENT_CALENDAR_AI_RULES = `Content rules (strict):
- Target audiences: only "Join the Team", "List With Us", or "Clients" — never Atlanta/virtual split in copy.
- "Join the Team" = trainers looking to become a Match Fit Fitness Pro (recruitment / onboarding).
- "List With Us" = independent trainers & facilities using Match Fit as a listing/discovery platform.
- "Clients" = athletes and individuals looking for training.
- Do NOT market Atlanta or local geography in captions; in-person sessions are Atlanta-only operationally but not a marketing hook.
- Always say "Fitness Pros" (never "trainers", "personal trainers", or "coaches" as the primary label).
- Canonical signup URLs only (never invent paths):
  - Fitness Pro / Join the Team / List With Us CTAs → match-fit.net/trainer/signup
  - Client CTAs → match-fit.net/client/sign-up
  - Never write match-fit.net/Fitness Pro/signup, match-fit.net/fitness-pro/signup, or similar.
- Maximum ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags per post (no # prefix in JSON array).
- Caption + hashtags combined must stay within ${CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT} characters (Threads repurpose limit).
- Align offers and urgency with live site/promo scan context when provided — do not invent caps or pricing.
- Never publish placeholder copy that only names post type, audience, or brand hex colors.`;
