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
