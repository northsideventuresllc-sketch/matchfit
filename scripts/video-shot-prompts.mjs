/**
 * Splits a Content Calendar video media-generation prompt into one prompt per
 * Video shot/scene, so `gemini-media-automation.mjs` generates separate video clips
 * via Google Flow / Veo instead of collapsing a 20-second multi-scene concept into
 * a single 6-8s clip.
 *
 * Two formats are recognized:
 *   1. Explicit delimiters: shots separated by a literal `---SHOT---` or `---SCENE---`.
 *   2. Content Calendar v2 structured shot format:
 *      One shared header block (Dimensions/Format/Branding/Rules), then natural-language
 *      shot labels like "Shot 1 (Scene 1 - 0-6s):", "Shot 2 (Scene 2 - 6-13s):", "Scene 1:",
 *      "Shot 3 (CTA - 13-20s):", followed by an optional "PRODUCTION SPEC (required):" footer.
 *      The header and footer apply to every shot, so each split-out prompt carries both
 *      along with just that shot's creative direction.
 *
 * Prompts with a single shot or without shot markers return as a single entry array.
 */

const LEGACY_SHOT_DELIMITER_RE = /---\s*(?:SHOT|SCENE)\s*---/i;
const SHOT_LABEL_RE = /^[ \t]*(?:Shot|Scene)\s+\d+\b[^\n:]*(?::|$)/gim;
const PRODUCTION_SPEC_RE = /^PRODUCTION SPEC \(required\):/im;

/**
 * Standard minimum shots for a multi-shot Video workflow.
 * A 18-24s video typically breaks into 3 shots (Hook, Body/Demo, CTA).
 * 2 is the minimum floor for multi-shot composition.
 */
export const MIN_VIDEO_SHOTS = 2;

/**
 * Throws if a Video row that should be multi-shot split into fewer than minShots prompts.
 * No-op for non-Video post types.
 */
export function assertVideoHasEnoughShots(postType, shotCount, { minShots = MIN_VIDEO_SHOTS } = {}) {
  if (postType !== "Video") return;
  if (shotCount < minShots) {
    throw new Error(
      `VIDEO_SPLIT_TOO_FEW_SHOTS: expected at least ${minShots} shot prompts for a multi-shot Video ` +
        `post, got ${shotCount}. Refusing to generate a single collapsed clip for a multi-scene video concept.`
    );
  }
}

/**
 * Splits a raw video prompt string into individual shot prompts.
 * Each resulting prompt contains the common header, the individual shot description,
 * and the common production spec footer.
 */
export function splitVideoShotPrompts(rawPrompt) {
  const text = String(rawPrompt ?? "").trim();
  if (!text) return [];

  if (LEGACY_SHOT_DELIMITER_RE.test(text)) {
    return text
      .split(/---\s*(?:SHOT|SCENE)\s*---/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const labelMatches = [...text.matchAll(SHOT_LABEL_RE)];
  if (labelMatches.length < 2) return [text];

  const specMatch = PRODUCTION_SPEC_RE.exec(text);
  const bodyEnd = specMatch ? specMatch.index : text.length;
  const footer = specMatch ? text.slice(specMatch.index).trim() : "";
  const header = text.slice(0, labelMatches[0].index).trim();

  return labelMatches.map((match, i) => {
    const start = match.index;
    const end = i + 1 < labelMatches.length ? labelMatches[i + 1].index : bodyEnd;
    const shot = text.slice(start, end).trim();
    return [header, shot, footer].filter(Boolean).join("\n\n");
  });
}
