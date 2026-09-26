import { describe, expect, it } from "vitest";
import {
  splitVideoShotPrompts,
  assertVideoHasEnoughShots,
  MIN_VIDEO_SHOTS,
} from "./video-shot-prompts.mjs";

const HEADER = `Dimensions: 9:16 (1080x1920)
Format: 3-shot vertical video MP4 (20 seconds total)
Branding: Match Fit brand colors (dark #07080C background, #FF7E00 orange accents).
Rules:
- Keep all text inside the 9:16 vertical safe zone (clear of bottom/side UI).
- Seamless continuity across cuts.`;

const SHOTS = [
  'Shot 1 (Scene 1 - 0-6s Hook): Fast-paced opening. A personal trainer looks directly into the camera in a modern gym, tapping his phone screen with high energy. On-screen text: "Stop Losing Training Clients".',
  'Shot 2 (Scene 2 - 6-13s Value/Demo): Over-the-shoulder medium shot showing the Match Fit app interface. The client booking confirmation animates with an orange checkmark. On-screen text: "Automated Booking & Client Matching".',
  'Shot 3 (Scene 3 - 13-20s CTA): Dynamic closing shot. The trainer smiles and gives a nod while packing his gym bag. On-screen text: "Join the Founding 30 at match-fit.net/trainer/sign-up".',
];

const PRODUCTION_SPEC = `PRODUCTION SPEC (required):
- Output dimensions: 1080x1920px, 9:16 vertical. Use case: Reels / TikTok / Facebook Reels / Threads video.
- Brand colors: dark background #07080C with #FF7E00 orange as the accent.
- Incorporate the Match Fit logo (/brand/matchfit-logo.png) — place it cleanly in the top right corner.
- Apply the spec to the opening hook frame / thumbnail and keep on-screen text inside the vertical safe zone.`;

function realisticVideoPrompt() {
  return [HEADER, "", SHOTS.join("\n\n"), "", PRODUCTION_SPEC].join("\n");
}

describe("splitVideoShotPrompts", () => {
  it("splits a structured 3-shot video prompt into 3 discrete prompts", () => {
    const result = splitVideoShotPrompts(realisticVideoPrompt());

    expect(result).toHaveLength(3);
    result.forEach((prompt, i) => {
      expect(prompt).toContain(SHOTS[i]);
      expect(prompt).toContain("Dimensions: 9:16 (1080x1920)");
      expect(prompt).toContain("PRODUCTION SPEC (required):");
    });
    // Individual shot creative directions must not bleed into adjacent shots
    expect(result[0]).not.toContain("Automated Booking & Client Matching");
    expect(result[0]).not.toContain("Join the Founding 30");
    expect(result[1]).not.toContain("Stop Losing Training Clients");
    expect(result[2]).not.toContain("Stop Losing Training Clients");
  });

  it("splits a video prompt without a PRODUCTION SPEC footer", () => {
    const prompt = [HEADER, "", SHOTS.join("\n\n")].join("\n");
    const result = splitVideoShotPrompts(prompt);

    expect(result).toHaveLength(3);
    expect(result[0]).toContain(SHOTS[0]);
    expect(result[0]).not.toContain("PRODUCTION SPEC");
  });

  it("supports Scene N label notation", () => {
    const scenePrompt = [
      HEADER,
      "",
      "Scene 1: Opening hook shot of athlete sprinting on track.",
      "Scene 2: Close up on smartwatch showing match fitness metrics.",
      "Scene 3: Athlete celebrating finish line with orange Match Fit gear.",
    ].join("\n\n");

    const result = splitVideoShotPrompts(scenePrompt);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("Scene 1: Opening hook shot");
    expect(result[1]).toContain("Scene 2: Close up on smartwatch");
    expect(result[2]).toContain("Scene 3: Athlete celebrating");
  });

  it("falls back to explicit ---SHOT--- and ---SCENE--- delimiters", () => {
    const prompt1 = ["First shot clip.", "Second shot clip."].join("\n---SHOT---\n");
    const result1 = splitVideoShotPrompts(prompt1);
    expect(result1).toEqual(["First shot clip.", "Second shot clip."]);

    const prompt2 = ["Scene A", "Scene B", "Scene C"].join("\n---SCENE---\n");
    const result2 = splitVideoShotPrompts(prompt2);
    expect(result2).toEqual(["Scene A", "Scene B", "Scene C"]);
  });

  it("returns a single entry for single-shot prompts or prompts without shot labels", () => {
    const singlePrompt = "A continuous 6-second video of a coach walking into a sunlit gym.";
    expect(splitVideoShotPrompts(singlePrompt)).toEqual([singlePrompt]);

    const oneShotLabeled = `${HEADER}\n\nShot 1 (Scene 1): Only one shot listed in this prompt.`;
    expect(splitVideoShotPrompts(oneShotLabeled)).toEqual([oneShotLabeled]);
  });

  it("handles empty / null / undefined gracefully", () => {
    expect(splitVideoShotPrompts("")).toEqual([]);
    expect(splitVideoShotPrompts(null)).toEqual([]);
    expect(splitVideoShotPrompts(undefined)).toEqual([]);
  });
});

describe("assertVideoHasEnoughShots", () => {
  it("throws when a multi-shot Video splits into fewer than minShots", () => {
    expect(() => assertVideoHasEnoughShots("Video", 1)).toThrow(/VIDEO_SPLIT_TOO_FEW_SHOTS/);
  });

  it("does not throw when shotCount is >= MIN_VIDEO_SHOTS", () => {
    expect(() => assertVideoHasEnoughShots("Video", MIN_VIDEO_SHOTS)).not.toThrow();
    expect(() => assertVideoHasEnoughShots("Video", 3)).not.toThrow();
  });

  it("is a no-op for non-Video post types", () => {
    expect(() => assertVideoHasEnoughShots("Static", 1)).not.toThrow();
    expect(() => assertVideoHasEnoughShots("Carousel", 1)).not.toThrow();
    expect(() => assertVideoHasEnoughShots("Text", 0)).not.toThrow();
  });

  it("respects custom minShots override", () => {
    expect(() => assertVideoHasEnoughShots("Video", 2, { minShots: 3 })).toThrow(/VIDEO_SPLIT_TOO_FEW_SHOTS/);
    expect(() => assertVideoHasEnoughShots("Video", 3, { minShots: 3 })).not.toThrow();
  });
});
