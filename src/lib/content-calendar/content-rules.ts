import type { ContentCalendarGroup } from "@/lib/content-calendar/constants";

/** Repurpose-safe limit: smallest caption budget across Match Fit platforms (Threads). */
export const CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT = 500;

export const CONTENT_CALENDAR_MAX_HASHTAGS = 5;

/** Legacy audience labels stored before the Fitness Pros / Clients split. */
const LEGACY_GROUP_MAP: Record<string, ContentCalendarGroup> = {
  "Atlanta Trainers": "Fitness Pros",
  "Virtual Trainers": "Fitness Pros",
  "Atlanta Clients": "Clients",
  "Virtual Clients": "Clients",
};

export function normalizeTargetGroup(group: string): ContentCalendarGroup {
  if (group === "Fitness Pros" || group === "Clients") return group;
  return LEGACY_GROUP_MAP[group] ?? "Fitness Pros";
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

/** Marketing copy should say Fitness Pros instead of trainer(s). */
export function normalizeFitnessProLanguage(text: string): string {
  return text
    .replace(/\bpersonal trainers\b/gi, "Fitness Pros")
    .replace(/\bpersonal trainer\b/gi, "Fitness Pro")
    .replace(/\btrainers\b/gi, "Fitness Pros")
    .replace(/\btrainer\b/gi, "Fitness Pro");
}

export const CONTENT_CALENDAR_AI_RULES = `Content rules (strict):
- Target audiences: only "Fitness Pros" or "Clients" — never Atlanta/virtual split in copy.
- Do NOT market Atlanta or local geography in captions; in-person sessions are Atlanta-only operationally but not a marketing hook.
- Always say "Fitness Pros" (never "trainers", "personal trainers", or "coaches" as the primary label).
- Maximum ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags per post (no # prefix in JSON array).
- Caption + hashtags combined must stay within ${CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT} characters (Threads repurpose limit).
- Align offers and urgency with live site/promo scan context when provided — do not invent caps or pricing.`;
