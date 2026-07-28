import "server-only";

import { createNiBrainClient } from "@/lib/ni-brain-client";

/** NI Brain Supabase Storage bucket that hosts every content-calendar image/video asset. */
export const CONTENT_CALENDAR_MEDIA_BUCKET = "content-calendar-media";

export function safeMediaPathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "file";
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function mediaExtensionForMimeType(mimeType: string | null | undefined): string {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_EXTENSIONS[normalized] ?? "png";
}

/**
 * Single upload path for generated content-calendar media.
 *
 * Both the Cowork media-upload route (a desktop session re-hosting a local file) and the
 * in-app Gemini image generator (which only ever gets raw base64 bytes back, never a URL)
 * go through here so the bucket, naming, and public-URL resolution can't drift apart.
 */
export async function uploadContentCalendarMedia(args: {
  bytes: Uint8Array;
  path: string;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  const client = createNiBrainClient();
  const { error } = await client.storage
    .from(CONTENT_CALENDAR_MEDIA_BUCKET)
    .upload(args.path, args.bytes, { contentType: args.contentType, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(CONTENT_CALENDAR_MEDIA_BUCKET).getPublicUrl(args.path);
  if (!data?.publicUrl) throw new Error("Supabase Storage returned no public URL.");
  return { url: data.publicUrl, path: args.path };
}
