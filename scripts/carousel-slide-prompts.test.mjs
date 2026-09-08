import { describe, expect, it } from "vitest";
import {
  splitCarouselSlidePrompts,
  assertCarouselHasEnoughSlides,
  MIN_CAROUSEL_SLIDES,
} from "./carousel-slide-prompts.mjs";

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

  it("splits the exact live prompt from the 2026-09-07 incident (post 2b0ab910) into 5 slides", () => {
    // Regression test: the real last_generation_prompt from post
    // 2b0ab910-98f4-470b-9d1d-f3b57fd1b5a0 (week 2026-09-07, day_index 0, Carousel),
    // which reached media_status="ready" with only 1 of 5 images. Confirms the current
    // splitter handles this exact text correctly (root cause was a stale deployed copy
    // on the mini predating this splitter, not a defect in this function against this
    // prompt shape) — and guards against ever regressing on this specific input again.
    const incidentPrompt = [
      'Dimensions: 4:5 (1080x1350). Format: single PNG. \nBranding: Match Fit dark #07080C background with orange #FF7E00 accent lines and logo in top-right corner. \nRules: all text stays in top 3/4 of frame.',
      'Slide 1 (Image 1): Center-frame close-up of a confident mid-30s male Personal Trainer (light skin, athletic build) standing in a modern gym, holding a smartphone and smiling. On-screen text: "LIST YOUR FITNESS BUSINESS" in bold text with an orange neon glow and a black outline around white letters reading "LIST YOUR FITNESS BUSINESS".',
      'Slide 2 (Image 2): Over-the-shoulder shot of a female fitness trainer (dark skin, fit build) typing on a laptop that displays a Match Fit dashboard with a pop up button that says "LIST NOW" highlighted in orange. On-screen text: "CLIENTS COME TO YOU" in bold text with an orange neon glow and a black outline around white letters reading "CLIENTS COME TO YOU".',
      'Slide 3 (Image 3): A split-frame showing a male trainer (athletic build, tan skin) on the left side of the frame looking at his phone with a satisfied expression, and a female client (fit, dark hair) on the right side of the frame smiling while scrolling on her phone. On-screen text: "MATCHED BASED OFF OF FIT" in bold text with an orange neon glow and a black outline around white letters reading "MATCHED BASED OFF OF FIT".',
      'Slide 4 (Image 4): A laptop screen (center frame) showing a Match Fit listing page with a "BOOK NOW" button and a "VISIT OUR SITE" external link clearly visible. On-screen text: "SECURE LONG TERM CLIENTS" in bold text with an orange neon glow and a black outline around white letters reading "SECURE LONG TERM CLIENTS".',
      'Slide 5 (Image 5): A trainer (mid-20s, light skin, energetic) standing in front of a gym mirror with a phone in hand showing Match Fit analytics. On-screen text: "Match Fit. " in bold text with an orange neon glow and a black outline around white letters reading "Match Fit. Build Momentum That Lasts".',
      'ALL TEXT AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT.',
      'PRODUCTION SPEC: 1080x1350px, 4:5 ratio. Brand hexes: #07080C (dark), #FF7E00 (orange). Logo: top-right corner on every slide. Safe zone: text stays in top 3/4 of frame.',
      'PRODUCTION SPEC (required):\n- Output dimensions: 1080x1350px, 4:5 portrait. Use case: Instagram / Facebook / TikTok / Threads swipeable carousel — hold a consistent 4:5 across every frame.\n- Brand colors: dark background #07080C with #FF7E00 orange as the accent (headline text, highlights, CTA chip). Do not invent other brand colors.\n- Incorporate the Match Fit logo — place it cleanly (corner or lockup) without covering the focal subject or headline.\n- Keep the logo placement, palette, and 4:5 frame consistent across all carousel slides.',
    ].join("\n\n");

    const result = splitCarouselSlidePrompts(incidentPrompt);
    expect(result).toHaveLength(5);
    expect(result[0]).toContain("LIST YOUR FITNESS BUSINESS");
    expect(result[1]).toContain("CLIENTS COME TO YOU");
    expect(result[2]).toContain("MATCHED BASED OFF OF FIT");
    expect(result[3]).toContain("SECURE LONG TERM CLIENTS");
    expect(result[4]).toContain("Build Momentum That Lasts");
  });
});

describe("assertCarouselHasEnoughSlides", () => {
  it("throws for a Carousel that split into fewer than MIN_CAROUSEL_SLIDES prompts", () => {
    expect(() => assertCarouselHasEnoughSlides("Carousel", 1)).toThrow(/CAROUSEL_SPLIT_TOO_FEW_SLIDES/);
    expect(() => assertCarouselHasEnoughSlides("Carousel", 2)).toThrow(/CAROUSEL_SPLIT_TOO_FEW_SLIDES/);
  });

  it("this is exactly the 2026-09-07 incident shape: a real 5-slide Carousel collapsing to 1", () => {
    // The naive legacy splitter (pre-#351) on a prompt with no literal ---SLIDE--- marker
    // returns the whole prompt as ONE entry. This is the gate that must now catch that.
    expect(() => assertCarouselHasEnoughSlides("Carousel", 1)).toThrow();
  });

  it("does not throw for a Carousel with MIN_CAROUSEL_SLIDES or more", () => {
    expect(() => assertCarouselHasEnoughSlides("Carousel", MIN_CAROUSEL_SLIDES)).not.toThrow();
    expect(() => assertCarouselHasEnoughSlides("Carousel", 5)).not.toThrow();
  });

  it("is a no-op for non-Carousel post types regardless of slide count", () => {
    expect(() => assertCarouselHasEnoughSlides("Static", 1)).not.toThrow();
    expect(() => assertCarouselHasEnoughSlides("Video", 1)).not.toThrow();
    expect(() => assertCarouselHasEnoughSlides("Text", 0)).not.toThrow();
  });

  it("respects a custom minSlides override (used for the post-generation partial-result check)", () => {
    expect(() => assertCarouselHasEnoughSlides("Carousel", 4, { minSlides: 5 })).toThrow(
      /CAROUSEL_SPLIT_TOO_FEW_SLIDES/,
    );
    expect(() => assertCarouselHasEnoughSlides("Carousel", 5, { minSlides: 5 })).not.toThrow();
  });
});
