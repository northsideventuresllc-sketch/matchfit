/**
 * Splits a Content Calendar media-generation prompt into one prompt per
 * Carousel slide, so `gemini-media-automation.mjs` generates a separate
 * image per slide instead of collapsing a whole carousel into one prompt.
 *
 * Two formats are recognized:
 *   1. Legacy manual marker: slides separated by a literal `---SLIDE---`
 *      delimiter. Kept for backward compatibility with hand-authored prompts.
 *   2. The real Content Calendar v2 format (`CONTENT_CALENDAR_CREATIVE_QUALITY_RULES`
 *      in `src/lib/content-calendar/content-prompts.ts`): one shared header
 *      block (Dimensions/Format/Branding/Rules), then natural-language slide
 *      labels like "Slide 1 (Image 1):", "Slide 2:", "Slide 5 CTA card:", then
 *      an optional "PRODUCTION SPEC (required):" footer appended by
 *      `buildMediaGenerationPrompt`. The header and footer apply to every
 *      slide, so each split-out prompt carries both along with just that
 *      slide's text.
 *
 * A prompt with neither format (a single-image post, or a carousel prompt
 * that doesn't follow the expected shape) is returned as a single entry,
 * matching a single-image generation.
 */

const LEGACY_SLIDE_DELIMITER_RE = /---\s*SLIDE\s*---/i;
const SLIDE_LABEL_RE = /^[ \t]*Slide\s+\d+\b[^\n:]*:/gim;
const PRODUCTION_SPEC_RE = /^PRODUCTION SPEC \(required\):/im;

/**
 * Hard floor for a real Carousel: CONTENT_CALENDAR_CREATIVE_QUALITY_RULES (content-prompts.ts)
 * locks a Carousel to 3-5 slides. 3 is the correctness floor used here — below that, a split
 * result means the splitter failed to recognize the prompt's slide labels (stale deployed copy,
 * or a future prompt format it doesn't understand), not that the row is a legitimate 1-2 slide
 * carousel (there is no such thing).
 */
export const MIN_CAROUSEL_SLIDES = 3;

/**
 * Throws if a Carousel row split into fewer than MIN_CAROUSEL_SLIDES prompts. This is the
 * gate that stops the 2026-09-07 incident (post 2b0ab910-98f4-470b-9d1d-f3b57fd1b5a0: a real
 * 5-slide Carousel prompt collapsed to ONE combined generation and still reached
 * media_status="ready") from ever reaching "ready" again — independent of whether
 * splitCarouselSlidePrompts() itself is the current version or a stale deployed copy.
 * No-op for any other post_type.
 */
export function assertCarouselHasEnoughSlides(postType, slideCount, { minSlides = MIN_CAROUSEL_SLIDES } = {}) {
  if (postType !== "Carousel") return;
  if (slideCount < minSlides) {
    throw new Error(
      `CAROUSEL_SPLIT_TOO_FEW_SLIDES: expected at least ${minSlides} slide prompts for a Carousel ` +
        `post, got ${slideCount}. Refusing to generate/accept a partial carousel — this is either a ` +
        `stale deployed copy of gemini-media-automation.mjs/carousel-slide-prompts.mjs on the mini ` +
        `(redeploy from main) or a prompt format splitCarouselSlidePrompts() no longer recognizes.`
    );
  }
}

export function splitCarouselSlidePrompts(rawPrompt) {
  const text = String(rawPrompt ?? "").trim();
  if (!text) return [];

  if (LEGACY_SLIDE_DELIMITER_RE.test(text)) {
    return text
      .split(/---\s*SLIDE\s*---/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const labelMatches = [...text.matchAll(SLIDE_LABEL_RE)];
  if (labelMatches.length < 2) return [text];

  const specMatch = PRODUCTION_SPEC_RE.exec(text);
  const bodyEnd = specMatch ? specMatch.index : text.length;
  const footer = specMatch ? text.slice(specMatch.index).trim() : "";
  const header = text.slice(0, labelMatches[0].index).trim();

  return labelMatches.map((match, i) => {
    const start = match.index;
    const end = i + 1 < labelMatches.length ? labelMatches[i + 1].index : bodyEnd;
    const slide = text.slice(start, end).trim();
    return [header, slide, footer].filter(Boolean).join("\n\n");
  });
}
