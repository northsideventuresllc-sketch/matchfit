import "server-only";

import { resolveGeminiApiKeyChain } from "@/lib/ai-vault/keys";
import { normalizeCoachLanguage } from "@/lib/content-calendar/content-rules";
import {
  mediaExtensionForMimeType,
  uploadContentCalendarMedia,
} from "@/lib/content-calendar/media-storage";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const MEDIA_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;

export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];

export function isMediaAspectRatio(value: unknown): value is MediaAspectRatio {
  return typeof value === "string" && (MEDIA_ASPECT_RATIOS as readonly string[]).includes(value);
}

/**
 * JB direct live order 2026-09-01 (tightened from the earlier "Pro first, Flash fallback"
 * version same day): Flash-tier image output is NEVER acceptable for Match Fit content — not
 * even as a fallback. Only the Pro-tier model is used. On any error, retry the SAME Pro model
 * (see GEMINI_IMAGE_MAX_ATTEMPTS below) instead of falling through to a worse model.
 *
 * There is deliberately NO paid fallback here — CLAUDE.md standing rule 1: nothing routes to a
 * paid API. When the free quota is gone we fail loudly and wait for the daily reset.
 */
export const GEMINI_IMAGE_MODEL = "gemini-3.1-pro-image";

/** How many times to retry the Pro model on a non-quota error before giving up on a key. */
export const GEMINI_IMAGE_MAX_ATTEMPTS = 10;

export function resolveGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || GEMINI_IMAGE_MODEL;
}

const GEMINI_IMAGE_TIMEOUT_MS = 90_000;
const MAX_PROMPT_CHARS = 3900;

/** Reason strings are plain English on purpose — they surface verbatim in cron job errors. */
export const IMAGE_QUOTA_EXHAUSTED_REASON = "free image quota exhausted for today";

export type GeneratedMediaResult =
  | { ok: true; url: string; path: string; model: string; aspectRatio: MediaAspectRatio }
  | { ok: false; reason: string };

type GeminiImagePart = {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mimeType?: string; mime_type?: string; data?: string };
  text?: string;
};

type GeminiImageResponse = {
  candidates?: Array<{ content?: { parts?: GeminiImagePart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

type GeminiImageAttempt =
  | { kind: "image"; bytes: Uint8Array; mimeType: string }
  | { kind: "error"; status?: number; reason: string };

function summarizeHttpError(status: number, body: string, label: string): string {
  let detail = body.slice(0, 240).replace(/\s+/g, " ").trim();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    detail = parsed.error?.message ?? parsed.message ?? detail;
  } catch {
    // keep the raw body snippet
  }
  return `${label} HTTP ${status}${detail ? `: ${detail}` : ""}`;
}

function extractInlineImage(data: GeminiImageResponse): { bytes: Uint8Array; mimeType: string } | null {
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      const base64 = inline?.data;
      if (!base64) continue;
      const mimeType =
        (inline as { mimeType?: string; mime_type?: string } | undefined)?.mimeType ??
        (inline as { mime_type?: string } | undefined)?.mime_type ??
        "image/png";
      try {
        return { bytes: new Uint8Array(Buffer.from(base64, "base64")), mimeType };
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function requestGeminiImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: MediaAspectRatio;
  label: string;
}): Promise<GeminiImageAttempt> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent`;
  const label = `${args.label} (${args.model})`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: args.aspectRatio },
        },
      }),
      signal: AbortSignal.timeout(GEMINI_IMAGE_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      kind: "error",
      reason: timedOut
        ? `${label} request timed out after ${Math.round(GEMINI_IMAGE_TIMEOUT_MS / 1000)}s`
        : `${label} request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { kind: "error", status: res.status, reason: summarizeHttpError(res.status, body, label) };
  }

  let data: GeminiImageResponse;
  try {
    data = (await res.json()) as GeminiImageResponse;
  } catch {
    return { kind: "error", status: res.status, reason: `${label} returned a non-JSON response` };
  }

  const image = extractInlineImage(data);
  if (image?.bytes.length) return { kind: "image", bytes: image.bytes, mimeType: image.mimeType };

  const blockReason = data.promptFeedback?.blockReason;
  const finishReason = data.candidates?.[0]?.finishReason;
  const detail = blockReason
    ? ` (prompt blocked: ${blockReason})`
    : finishReason && finishReason !== "STOP"
      ? ` (finishReason: ${finishReason})`
      : "";
  return { kind: "error", status: res.status, reason: `${label} returned no image in the response${detail}` };
}

function buildImagePrompt(prompt: string, aspectRatio: MediaAspectRatio): string {
  return `Match Fit fitness brand social graphic. Dark background #07080C, orange accent #FF7E00. Compose for a ${aspectRatio} frame. ${normalizeCoachLanguage(
    prompt,
  )}`.slice(0, MAX_PROMPT_CHARS);
}

function generatedMediaPath(mimeType: string, aspectRatio: MediaAspectRatio): string {
  const day = new Date().toISOString().slice(0, 10);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ratio = aspectRatio.replace(":", "x");
  return `ai-generated/${day}/${ratio}-${unique}.${mediaExtensionForMimeType(mimeType)}`;
}

/**
 * Generates one branded image on the FREE Gemini API and hosts it in NI Brain Supabase Storage.
 *
 * History: this used to call OpenAI DALL·E 3 with a hardcoded 1024x1024 size, keyed off an
 * `OPENAI_API_KEY` that was never a real OpenAI key. Every call therefore failed, and because it
 * returned a bare `null` with no log, an approved batch reached the 2026-07-27 publishing window
 * with zero images and no error recorded anywhere. Two things changed: it is free-tier Gemini
 * only, and every failure now carries a plain-English `reason` the caller must handle.
 *
 * Key order follows the AI Vault convention: `GEMINI_API_KEY`, then `GEMINI_API_KEY_BACKUP`,
 * both read from `platform_secrets` — never from source. On HTTP 429 the primary key is
 * abandoned immediately and the backup is tried once; if that is also rate-limited we stop and
 * report the quota reason. Free image quota resets daily, so the next morning's run recovers on
 * its own without a code change.
 */
/** Brief pause between retries of the same model so a transient error gets a fresh shot. */
const GEMINI_IMAGE_RETRY_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateStaticMedia(
  prompt: string,
  aspectRatio: MediaAspectRatio = "1:1",
): Promise<GeneratedMediaResult> {
  const trimmedPrompt = prompt?.trim();
  if (!trimmedPrompt) return fail("no image prompt was provided");

  await hydratePlatformEnvFromDatabase();
  const keyChain = resolveGeminiApiKeyChain();
  if (!keyChain.length) {
    return fail("no Gemini API key configured (set GEMINI_API_KEY in platform_secrets)");
  }

  const fullPrompt = buildImagePrompt(trimmedPrompt, aspectRatio);
  const model = resolveGeminiImageModel();
  let quotaBlocked = false;
  let lastReason: string | null = null;

  for (const entry of keyChain) {
    const label = entry.slot === "primary" ? "Gemini primary" : "Gemini backup";
    let keyQuotaBlocked = false;

    // JB direct order 2026-09-01: never fall through to a worse model. Retry this same
    // Pro-tier model up to GEMINI_IMAGE_MAX_ATTEMPTS times on this key before moving on.
    for (let attemptNumber = 1; attemptNumber <= GEMINI_IMAGE_MAX_ATTEMPTS; attemptNumber++) {
      const attempt = await requestGeminiImage({
        apiKey: entry.key,
        model,
        prompt: fullPrompt,
        aspectRatio,
        label,
      });

      if (attempt.kind === "image") {
        try {
          const { url, path } = await uploadContentCalendarMedia({
            bytes: attempt.bytes,
            path: generatedMediaPath(attempt.mimeType, aspectRatio),
            contentType: attempt.mimeType,
          });
          return { ok: true, url, path, model, aspectRatio };
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          return fail(`image generated but hosting it in Supabase Storage failed: ${message}`);
        }
      }

      lastReason = attempt.reason;

      // 429 is quota, not a transient error — retrying the same key won't help; try the backup key.
      if (attempt.status === 429) {
        keyQuotaBlocked = true;
        quotaBlocked = true;
        break;
      }

      // Any other error (model temporarily unavailable, timeout, no image returned, etc.):
      // retry the same Pro model rather than falling back to a different one.
      if (attemptNumber < GEMINI_IMAGE_MAX_ATTEMPTS) {
        await sleep(GEMINI_IMAGE_RETRY_DELAY_MS);
      }
    }

    if (!keyQuotaBlocked) break;
  }

  if (quotaBlocked) return fail(IMAGE_QUOTA_EXHAUSTED_REASON);
  return fail(
    lastReason
      ? `${lastReason} (after ${GEMINI_IMAGE_MAX_ATTEMPTS} attempts on ${model})`
      : `Gemini image generation failed for every configured key after ${GEMINI_IMAGE_MAX_ATTEMPTS} attempts on ${model}`,
  );
}

function fail(reason: string): { ok: false; reason: string } {
  console.error(`[content-calendar image generation] ${reason}`);
  return { ok: false, reason };
}

/** True when a free Gemini key is present, i.e. image generation can run at all. */
export function isImageGenerationConfigured(): boolean {
  return resolveGeminiApiKeyChain().length > 0;
}
