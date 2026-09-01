import "server-only";

import NSpell from "nspell";
import enDictionary from "dictionary-en";

/**
 * Spellcheck pass on outreach DM/email copy, run immediately after generation and before the
 * lead is ever written to a row JB can open in Outreach HQ (Fix #3, OUT-SPELLCHECK-PRE-APPROVAL).
 *
 * Approved copy is never auto-edited after JB signs off — that rule is untouched. This only
 * touches copy BEFORE it has ever been shown to him, so a typo never reaches the approval screen
 * in the first place. Deliberately conservative: only swaps a word for nspell's own top
 * suggestion, only when the suggestion is a near-miss in length, skips @handles/URLs/the brand
 * domain, and caps how many words one pass will touch so a scraped company name full of garbled
 * text can't get rewritten into something unrecognizable.
 */

const MAX_CORRECTIONS_PER_TEXT = 5;
/** Never rewrite a run shorter than this — avoids false positives on short brand tokens/initials. */
const MIN_WORD_LENGTH = 4;
/** A suggestion further than this from the original word length is a different word, not a typo fix. */
const MAX_SUGGESTION_LENGTH_DELTA = 2;

let spellerPromise: Promise<NSpell> | null = null;

function loadSpeller(): Promise<NSpell> {
  if (!spellerPromise) {
    spellerPromise = Promise.resolve(
      NSpell(enDictionary as unknown as { aff: Buffer; dic: Buffer }),
    );
  }
  return spellerPromise;
}

function matchCase(original: string, suggestion: string): string {
  if (original === original.toUpperCase()) return suggestion.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1).toLowerCase();
  }
  return suggestion.toLowerCase();
}

export type SpellcheckResult = { text: string; corrections: { from: string; to: string }[] };

/**
 * Runs the pass on one string of generated copy. Never throws — a dictionary load failure just
 * skips the pass (the copy still goes to JB unfixed, which is the pre-existing behaviour, not a
 * regression) rather than failing lead generation.
 */
export async function spellcheckOutreachCopy(text: string): Promise<SpellcheckResult> {
  if (!text || !text.trim()) return { text, corrections: [] };

  let speller: NSpell;
  try {
    speller = await loadSpeller();
  } catch (err) {
    console.warn("[outreach-spellcheck] dictionary load failed, skipping pass:", err);
    return { text, corrections: [] };
  }

  // Ranges to never touch: @handles, URLs, and the Match Fit domain itself.
  const protectedRanges: [number, number][] = [];
  const protectRe = /(@[A-Za-z0-9._]+)|(https?:\/\/\S+)|(\bmatch-fit\.net\b)/gi;
  let guard: RegExpExecArray | null;
  while ((guard = protectRe.exec(text))) {
    protectedRanges.push([guard.index, guard.index + guard[0].length]);
  }

  const corrections: { from: string; to: string }[] = [];
  const wordRe = new RegExp(`[A-Za-z]{${MIN_WORD_LENGTH},}`, "g");

  const fixed = text.replace(wordRe, (word, offset: number) => {
    if (corrections.length >= MAX_CORRECTIONS_PER_TEXT) return word;
    if (protectedRanges.some(([start, end]) => offset >= start && offset < end)) return word;
    if (speller.correct(word)) return word;

    const suggestions = speller.suggest(word);
    const best = suggestions[0];
    if (!best) return word;
    if (Math.abs(best.length - word.length) > MAX_SUGGESTION_LENGTH_DELTA) return word;

    const replacement = matchCase(word, best);
    if (replacement === word) return word;
    corrections.push({ from: word, to: replacement });
    return replacement;
  });

  if (corrections.length > 0) {
    console.log(
      `[outreach-spellcheck] pre-approval fix: ${corrections.map((c) => `${c.from}->${c.to}`).join(", ")}`,
    );
  }

  return { text: fixed, corrections };
}
