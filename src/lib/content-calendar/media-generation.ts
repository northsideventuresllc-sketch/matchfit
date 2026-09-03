import "server-only";

export const MEDIA_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;

export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];

export function isMediaAspectRatio(value: unknown): value is MediaAspectRatio {
  return typeof value === "string" && (MEDIA_ASPECT_RATIOS as readonly string[]).includes(value);
}

/** Reason strings are plain English on purpose — they surface verbatim in cron job errors. */
export const IMAGE_QUOTA_EXHAUSTED_REASON = "free image quota exhausted for today";

export type GeneratedMediaResult =
  | { ok: true; url: string; path: string; model: string; aspectRatio: MediaAspectRatio }
  | { ok: false; reason: string };

/**
 * DEAD ON PURPOSE. JB direct order (Decision #1722 item 4 + same-date Learning, 2026-09-03):
 * "media generation is NEVER the Gemini API — it is my Gemini subscription in Chrome on the
 * Mac mini; this assumption is the main reason social media is not getting updated."
 *
 * This module used to call generativelanguage.googleapis.com directly with
 * `responseModalities: ["IMAGE"]`. The key behind that call has ZERO image quota — every
 * single call failed, silently or with a quota error, for as long as this path existed
 * (confirmed live 2026-08-04, re-confirmed 2026-09-02, see
 * src/lib/content-calendar/cowork-jobs.ts's queueMiniChromeAgentJob doc comment). The real
 * producer is scripts/gemini-media-automation.mjs on the Mac mini, driving JB's own logged-in
 * Gemini web session over CDP/Playwright, queued via queueMiniChromeAgentJob() in
 * @/lib/content-calendar/cowork-jobs. Nothing in this app may call an image-generation HTTP
 * API again — free or paid.
 *
 * This function is kept only so a stray import fails loudly instead of silently reintroducing
 * the API path. If you're looking for how to generate media, call
 * `queueMiniChromeAgentJob` / `fireMediaAgentForDay` / `fireMediaAgentForPost` instead.
 */
export async function generateStaticMedia(): Promise<GeneratedMediaResult> {
  throw new Error(
    "generateStaticMedia() is dead: media is generated in Chrome on the Mac mini via JB's Gemini " +
      "subscription (scripts/gemini-media-automation.mjs), never via an image API. Use " +
      "queueMiniChromeAgentJob() from @/lib/content-calendar/cowork-jobs instead.",
  );
}

/**
 * Always false: there is no image-generation API in this app to be "configured". Whether media
 * generation can run at all now depends on the Mac mini's job-queue runner (nvg_mini_jobs /
 * nvg_mini_heartbeat in NI-Brain), which this module deliberately has no visibility into.
 */
export function isImageGenerationConfigured(): boolean {
  return false;
}
