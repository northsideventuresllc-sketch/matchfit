import { CONTENT_CALENDAR_MAX_HASHTAGS } from "@/lib/content-calendar/content-rules";
import { formatHashtagsForPost, normalizeHashtags } from "@/lib/content-calendar/content-rules";

export function sanitizeHashtagDraftToken(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, "").trim();
  if (!tag) return null;
  return tag.slice(0, 100);
}

export function parseHashtagsInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((part) => sanitizeHashtagDraftToken(part))
    .filter((part): part is string => Boolean(part));
  return normalizeHashtags(parts);
}

export function hashtagsToInputValue(tags: string[]): string {
  return normalizeHashtags(tags).join("\n");
}

/**
 * Copy Post's clipboard format: the caption, a blank line, then the hashtags on their own
 * two-space-indented line — `{body}\n\n  {hashtags}` — so a paste into a platform composer keeps
 * the hashtag line visually distinct from the body. (Content Calendar v2, 2026-08-31.)
 */
export function buildCaptionWithHashtags(caption: string, hashtags: string[]): string {
  const tags = formatHashtagsForPost(hashtags);
  const trimmed = caption.trim();
  if (!tags) return trimmed;
  const indentedTags = `  ${tags}`;
  if (!trimmed) return indentedTags;
  return `${trimmed}\n\n${indentedTags}`;
}

/** Space-separated #tags for clipboard (no chip UI artifacts). */
export function formatHashtagsForClipboard(hashtags: string[]): string {
  return formatHashtagsForPost(hashtags);
}

export function maxHashtagHint(): string {
  return `Up to ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags. Press Enter to add each tag.`;
}
