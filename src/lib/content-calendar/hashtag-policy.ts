import type { ContentCalendarGroup } from "@/lib/content-calendar/constants";

/**
 * JB'S LOCKED HASHTAG RULE (ticket MF-HASHTAG-HIGHVOL, 2026-08-04)
 * ---------------------------------------------------------------
 * Use high-follower, already-popular hashtags ONLY.
 *   - No invented tags.
 *   - No low-volume long-tail tags.
 *   - No branded tags nobody searches (this includes #MatchFit while the brand
 *     has no search volume of its own — the brand goes in the caption, not the tags).
 *
 * This file is the single source of truth for that rule. Prompt text and the
 * deterministic coercion below both read from here, so the two can never drift.
 *
 * Every tag in the pools below is an established, high-volume tag on Instagram /
 * TikTok (millions to hundreds of millions of posts). Nothing here is invented.
 * Do not add a tag to these pools unless it is already popular at that scale.
 */

/** High-volume tags aimed at Fitness Pros (Join the Team / List With Us). */
export const HIGH_VOLUME_PRO_HASHTAGS = [
  "personaltrainer",
  "personaltraining",
  "fitnesscoach",
  "onlinecoaching",
  "onlinecoach",
  "fitnessbusiness",
  "fitnesstrainer",
  "fitnessprofessional",
  "strengthcoach",
  "gym",
  "fitness",
  "training",
  "coaching",
  "fitnessmotivation",
  "gymlife",
] as const;

/** High-volume tags aimed at training clients (Clients). */
export const HIGH_VOLUME_CLIENT_HASHTAGS = [
  "fitness",
  "workout",
  "gym",
  "fitnessmotivation",
  "gymlife",
  "fitfam",
  "fitnessjourney",
  "personaltrainer",
  "weightloss",
  "healthylifestyle",
  "training",
  "exercise",
  "gymmotivation",
  "transformation",
  "health",
  "homeworkout",
  "strengthtraining",
  "cardio",
  "wellness",
  "fitspo",
] as const;

/** Union of every approved high-volume tag, lowercased, no "#". */
export const HIGH_VOLUME_HASHTAGS: readonly string[] = Array.from(
  new Set<string>([...HIGH_VOLUME_PRO_HASHTAGS, ...HIGH_VOLUME_CLIENT_HASHTAGS])
);

const APPROVED = new Set<string>(HIGH_VOLUME_HASHTAGS);

function bareTag(raw: string): string {
  return String(raw).replace(/^#/, "").trim().toLowerCase();
}

/** True when `tag` is on the approved high-volume list. */
export function isHighVolumeHashtag(tag: string): boolean {
  return APPROVED.has(bareTag(tag));
}

/** The approved pool for a given audience, most-relevant first. */
export function highVolumePoolForGroup(group: ContentCalendarGroup | string): readonly string[] {
  return group === "Clients"
    ? HIGH_VOLUME_CLIENT_HASHTAGS
    : HIGH_VOLUME_PRO_HASHTAGS;
}

/**
 * Deterministically coerces a model's hashtag output to JB's locked rule.
 *
 * Anything off the approved list is dropped (that is where invented, long-tail
 * and dead branded tags get removed), then the set is backfilled from the
 * audience pool so a post never ships with fewer tags than requested. Prompting
 * alone is not enough — the model drifts back to niche tags, so this runs on
 * every generation path as the enforcement layer.
 */
export function enforceHighVolumeHashtags(
  tags: string[] | null | undefined,
  opts?: { group?: ContentCalendarGroup | string; max?: number }
): string[] {
  const max = opts?.max ?? 5;
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of tags ?? []) {
    const tag = bareTag(raw);
    if (!tag || seen.has(tag) || !APPROVED.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= max) return out;
  }

  for (const tag of highVolumePoolForGroup(opts?.group ?? "Join the Team")) {
    if (out.length >= max) break;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }

  return out;
}

/** Prompt text stating the locked rule. Injected into every generation prompt. */
export const HIGH_VOLUME_HASHTAG_RULE = [
  "HASHTAG RULE (LOCKED — no exceptions):",
  "- Use high-follower, already-popular hashtags ONLY. Every tag must already be a large, actively-searched tag on the platform.",
  "- Never invent a hashtag.",
  "- Never use low-volume long-tail tags (e.g. a five-word phrase nobody searches).",
  "- Never use branded tags nobody searches — no #MatchFit, no product names. The brand belongs in the caption, not the hashtags.",
  `- Choose ONLY from this approved high-volume list: ${HIGH_VOLUME_HASHTAGS.map((t) => `#${t}`).join(" ")}`,
  "- Tags outside that list are discarded automatically, so picking one just wastes a slot.",
].join("\n");
