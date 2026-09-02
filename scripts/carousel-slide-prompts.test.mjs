import { describe, expect, it } from "vitest";
import { splitCarouselSlidePrompts } from "./carousel-slide-prompts.mjs";

const HEADER = `Dimensions: 4:5 (1080x1350)
Format: 5-slide carousel (5 separate PNG images)
Branding: Match Fit brand colors (orange gradient and black).
Rules:
-All text and main visuals need to be located in the top 3/4 of each image.
-Keep formatting identical across every slide.`;

const SLIDES = [
  'Slide 1 (Image 1): A trainer smiling at his phone. Bold text reading "Train Your Clients Anywhere".',
  'Slide 2: Close up of the app UI. Bold text reading "Set Your Own Rates".',
  'Slide 3: A chat window between trainer and client. Bold text reading "Clients Matched To Your Specialty".',
  'Slide 4: A laptop showing match-fit.net. "Offer In-Person, Virtual, or DIY Plans"',
  'Slide 5 CTA card: orange gradient background reading "Sign Up in Minutes"',
];

const PRODUCTION_SPEC = `PRODUCTION SPEC (required):
- Output dimensions: 1080x1350px, 4:5 portrait. Use case: Carousel.
- Brand colors: dark background #0B0B0B with #FF7A00 orange as the accent.
- Incorporate the Match Fit logo — place it cleanly without covering the focal subject.
- Keep the logo placement, palette, and 4:5 frame consistent across all carousel slides.`;

function realisticCarouselPrompt() {
  return [HEADER, "", SLIDES.join("\n"), "", PRODUCTION_SPEC].join("\n");
}

describe("splitCarouselSlidePrompts", () => {
  it("splits the real Content Calendar carousel format into one prompt per slide", () => {
    const result = splitCarouselSlidePrompts(realisticCarouselPrompt());

    expect(result).toHaveLength(5);
    result.forEach((prompt, i) => {
      expect(prompt).toContain(SLIDES[i]);
      expect(prompt).toContain("Dimensions: 4:5 (1080x1350)");
      expect(prompt).toContain("PRODUCTION SPEC (required):");
    });
    // Slide-specific text should not bleed into other slides.
    expect(result[0]).not.toContain("Set Your Own Rates");
    expect(result[4]).not.toContain("Train Your Clients Anywhere");
  });

  it("splits the format even without a trailing PRODUCTION SPEC footer", () => {
    const prompt = [HEADER, "", SLIDES.join("\n")].join("\n");
    const result = splitCarouselSlidePrompts(prompt);

    expect(result).toHaveLength(5);
    expect(result[0]).toContain(SLIDES[0]);
    expect(result[0]).not.toContain("PRODUCTION SPEC");
  });

  it("falls back to the legacy ---SLIDE--- delimiter when present", () => {
    const prompt = ["First slide prompt.", "Second slide prompt.", "Third slide prompt."].join(
      "\n---SLIDE---\n",
    );
    const result = splitCarouselSlidePrompts(prompt);

    expect(result).toEqual(["First slide prompt.", "Second slide prompt.", "Third slide prompt."]);
  });

  it("returns a single entry for a single-image prompt with no slide labels", () => {
    const prompt = "A single hero image of a trainer coaching a client outdoors.";
    const result = splitCarouselSlidePrompts(prompt);

    expect(result).toEqual([prompt]);
  });

  it("returns a single entry when only one slide label is present", () => {
    const prompt = `${HEADER}\n\nSlide 1 (Image 1): Just one slide mentioned.`;
    const result = splitCarouselSlidePrompts(prompt);

    expect(result).toEqual([prompt]);
  });

  it("returns an empty array for an empty prompt", () => {
    expect(splitCarouselSlidePrompts("")).toEqual([]);
    expect(splitCarouselSlidePrompts(null)).toEqual([]);
    expect(splitCarouselSlidePrompts(undefined)).toEqual([]);
  });
});
