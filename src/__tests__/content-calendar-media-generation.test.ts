import { describe, expect, it } from "vitest";
import {
  generateStaticMedia,
  isImageGenerationConfigured,
  isMediaAspectRatio,
  MEDIA_ASPECT_RATIOS,
} from "@/lib/content-calendar/media-generation";

// Corrected 2026-09-03 (Decision #1722 item 4 + same-date Learning, lane D2): media generation
// is never a Gemini/OpenAI/any image API — it's JB's Gemini subscription in Chrome on the Mac
// mini, driven by scripts/gemini-media-automation.mjs and queued through
// queueMiniChromeAgentJob(). This module is intentionally dead so a stray import fails loudly
// instead of silently reintroducing an API call with zero image quota.
describe("media-generation.ts (dead on purpose — no image API allowed)", () => {
  it("generateStaticMedia always throws instead of calling an image API", async () => {
    await expect(generateStaticMedia()).rejects.toThrow(/Chrome on the Mac mini/i);
    await expect(generateStaticMedia()).rejects.toThrow(/queueMiniChromeAgentJob/);
  });

  it("isImageGenerationConfigured is always false — nothing in this app can be 'configured' to call an image API", () => {
    expect(isImageGenerationConfigured()).toBe(false);
  });

  it("still exposes the aspect ratio helpers other modules rely on", () => {
    expect(MEDIA_ASPECT_RATIOS).toContain("4:5");
    expect(isMediaAspectRatio("4:5")).toBe(true);
    expect(isMediaAspectRatio("not-a-ratio")).toBe(false);
  });
});
