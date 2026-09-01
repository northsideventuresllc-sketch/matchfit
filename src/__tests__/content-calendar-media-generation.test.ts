import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  hydratePlatformEnv: vi.fn(async () => {}),
  uploadContentCalendarMedia: vi.fn(),
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: M.hydratePlatformEnv,
}));

vi.mock("@/lib/content-calendar/media-storage", () => ({
  uploadContentCalendarMedia: M.uploadContentCalendarMedia,
  mediaExtensionForMimeType: (mimeType: string) => (mimeType === "image/jpeg" ? "jpg" : "png"),
  safeMediaPathSegment: (value: string) => value,
  CONTENT_CALENDAR_MEDIA_BUCKET: "content-calendar-media",
}));

import {
  generateStaticMedia,
  GEMINI_IMAGE_MAX_ATTEMPTS,
  GEMINI_IMAGE_MODEL,
} from "@/lib/content-calendar/media-generation";

const PNG_BASE64 = Buffer.from("fake-png-bytes").toString("base64");

function imageResponse(): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG_BASE64 } }] } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function quotaResponse(): Response {
  return new Response(
    JSON.stringify({ error: { message: "Quota exceeded for images per day." } }),
    { status: 429, headers: { "content-type": "application/json" } },
  );
}

/** Reads the JSON body of the nth recorded fetch call. */
function requestBody(fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

function apiKeyHeader(fetchMock: ReturnType<typeof vi.fn>, index: number): string | undefined {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return (init?.headers as Record<string, string> | undefined)?.["x-goog-api-key"];
}

describe("generateStaticMedia (free Gemini image generation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.GEMINI_API_KEY = "AIzaPrimaryTestKey";
    process.env.GEMINI_API_KEY_BACKUP = "AIzaBackupTestKey";
    delete process.env.GEMINI_IMAGE_MODEL;
    M.uploadContentCalendarMedia.mockResolvedValue({
      url: "https://ni-brain.test/storage/content-calendar-media/img.png",
      path: "ai-generated/2026-07-28/9x16-1.png",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;
  });

  it("requests IMAGE modality at the caller's aspect ratio and returns the hosted URL", async () => {
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStaticMedia("Vertical hook frame for a Reels video", "9:16");

    expect(result).toMatchObject({
      ok: true,
      url: "https://ni-brain.test/storage/content-calendar-media/img.png",
      aspectRatio: "9:16",
      model: GEMINI_IMAGE_MODEL,
    });

    const body = requestBody(fetchMock, 0) as {
      generationConfig?: { responseModalities?: string[]; imageConfig?: { aspectRatio?: string } };
    };
    expect(body.generationConfig?.responseModalities).toEqual(["IMAGE"]);
    expect(body.generationConfig?.imageConfig?.aspectRatio).toBe("9:16");
    expect(M.uploadContentCalendarMedia).toHaveBeenCalledTimes(1);
  });

  it("defaults to 1:1 so pre-existing callers keep working unchanged", async () => {
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStaticMedia("Square feed graphic");

    expect(result.ok).toBe(true);
    const body = requestBody(fetchMock, 0) as {
      generationConfig?: { imageConfig?: { aspectRatio?: string } };
    };
    expect(body.generationConfig?.imageConfig?.aspectRatio).toBe("1:1");
  });

  it("never calls a paid image API", async () => {
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    await generateStaticMedia("Any prompt", "4:5");

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("generativelanguage.googleapis.com");
      expect(String(call[0])).not.toContain("openai.com");
    }
  });

  it("on HTTP 429 retries the backup key once, then fails with the quota reason", async () => {
    const fetchMock = vi.fn(async () => quotaResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStaticMedia("Portrait carousel frame", "4:5");

    expect(result).toEqual({ ok: false, reason: "free image quota exhausted for today" });
    // Exactly one attempt per key — a 429 is quota, so walking the model chain is pointless.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(apiKeyHeader(fetchMock, 0)).toBe("AIzaPrimaryTestKey");
    expect(apiKeyHeader(fetchMock, 1)).toBe("AIzaBackupTestKey");
    expect(M.uploadContentCalendarMedia).not.toHaveBeenCalled();
  });

  it("succeeds on the backup key when the primary key is quota-blocked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(quotaResponse())
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStaticMedia("Portrait feed still", "4:5");

    expect(result.ok).toBe(true);
    expect(apiKeyHeader(fetchMock, 1)).toBe("AIzaBackupTestKey");
  });

  it("reports a clear reason when the response carries no image (after exhausting retries)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "I can't make that image." }] }, finishReason: "STOP" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateStaticMedia("Prompt with no image back", "4:5");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toContain("returned no image in the response");
    expect(M.uploadContentCalendarMedia).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("surfaces a blocked prompt as the reason instead of a bare failure (after exhausting retries)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateStaticMedia("Blocked prompt", "1:1");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toContain("prompt blocked: SAFETY");
    vi.useRealTimers();
  });

  it("retries the same Pro model (never a different one) on a transient error and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }))
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateStaticMedia("Fallback model prompt", "4:5");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toMatchObject({ ok: true, model: GEMINI_IMAGE_MODEL });
    expect(String(fetchMock.mock.calls[0][0])).toContain(GEMINI_IMAGE_MODEL);
    expect(String(fetchMock.mock.calls[1][0])).toContain(GEMINI_IMAGE_MODEL);
    expect(apiKeyHeader(fetchMock, 1)).toBe("AIzaPrimaryTestKey");
    vi.useRealTimers();
  });

  it("gives up after GEMINI_IMAGE_MAX_ATTEMPTS retries of the same model on a non-quota error, never falling back to a different model or key", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateStaticMedia("Persistently failing prompt", "4:5");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toContain(`after ${GEMINI_IMAGE_MAX_ATTEMPTS} attempts on ${GEMINI_IMAGE_MODEL}`);
    // A non-quota error is a model problem, not a key problem -- only the primary key is tried,
    // GEMINI_IMAGE_MAX_ATTEMPTS times, never the backup key and never a different model.
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_IMAGE_MAX_ATTEMPTS);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain(GEMINI_IMAGE_MODEL);
    }
    expect(apiKeyHeader(fetchMock, 0)).toBe("AIzaPrimaryTestKey");
    vi.useRealTimers();
  });

  it("fails with a no-key reason when no Gemini key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStaticMedia("Any prompt", "4:5");

    expect(result).toEqual({
      ok: false,
      reason: "no Gemini API key configured (set GEMINI_API_KEY in platform_secrets)",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an upload failure separately from a generation failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse()));
    M.uploadContentCalendarMedia.mockRejectedValueOnce(new Error("Bucket not found"));

    const result = await generateStaticMedia("Prompt", "4:5");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toContain("hosting it in Supabase Storage failed: Bucket not found");
  });
});
