import { CONTENT_CALENDAR_MAX_HASHTAGS } from "@/lib/content-calendar/content-rules";
import { formatHashtagsForPost, normalizeHashtags } from "@/lib/content-calendar/content-rules";

export function parseHashtagsInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return normalizeHashtags(parts);
}

export function hashtagsToInputValue(tags: string[]): string {
  return normalizeHashtags(tags).join("\n");
}

export function buildCaptionWithHashtags(caption: string, hashtags: string[]): string {
  const tags = formatHashtagsForPost(hashtags);
  const trimmed = caption.trim();
  if (!tags) return trimmed;
  if (!trimmed) return tags;
  return `${trimmed}\n\n${tags}`;
}

export function maxHashtagHint(): string {
  return `Up to ${CONTENT_CALENDAR_MAX_HASHTAGS} hashtags (one per line). Optimized for all platforms.`;
}
