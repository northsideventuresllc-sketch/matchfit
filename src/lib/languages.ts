/**
 * Shared spoken-language contract for the worldwide rollout (WP-1).
 *
 * PURE MODULE — no Prisma, no node built-ins, no server-only imports. Safe to
 * import from "use client" components.
 *
 * See docs/WORLDWIDE-ROLLOUT-PLAN.md §1.3. ISO 639-1 codes plus the "other"
 * escape hatch; a superset of the legacy six questionnaire ids.
 */

export const SPOKEN_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "pt",
  "zh",
  "de",
  "it",
  "nl",
  "ru",
  "ar",
  "hi",
  "bn",
  "ur",
  "ja",
  "ko",
  "vi",
  "th",
  "id",
  "ms",
  "tl",
  "tr",
  "pl",
  "uk",
  "ro",
  "el",
  "sv",
  "no",
  "da",
  "fi",
  "he",
  "sw",
  "other",
] as const;

export type SpokenLanguageCode = (typeof SPOKEN_LANGUAGE_CODES)[number];

/** English display labels — never show the raw code on screen. */
export const SPOKEN_LANGUAGE_LABELS: Record<SpokenLanguageCode, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  zh: "Mandarin Chinese",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  bn: "Bengali",
  ur: "Urdu",
  ja: "Japanese",
  ko: "Korean",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  tl: "Tagalog",
  tr: "Turkish",
  pl: "Polish",
  uk: "Ukrainian",
  ro: "Romanian",
  el: "Greek",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  he: "Hebrew",
  sw: "Swahili",
  other: "Other",
};

/**
 * Legacy trainer-questionnaire language ids → ISO 639-1 codes. Stored
 * `matchQuestionnaireAnswers` blobs may carry these forever; they must always
 * remain mappable.
 */
export const LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE: Record<string, SpokenLanguageCode> = {
  english: "en",
  spanish: "es",
  french: "fr",
  portuguese: "pt",
  mandarin: "zh",
  other: "other",
};

const SPOKEN_LANGUAGE_CODE_SET: ReadonlySet<string> = new Set(SPOKEN_LANGUAGE_CODES);

/**
 * Normalize a mixed list of legacy ids and/or ISO codes to deduped ISO codes:
 * maps legacy ids, passes through valid codes, drops unknowns, preserves
 * first-seen order.
 */
export function normalizeSpokenLanguageIds(ids: string[]): SpokenLanguageCode[] {
  const out: SpokenLanguageCode[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    const legacy = Object.prototype.hasOwnProperty.call(LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE, id)
      ? LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE[id]
      : null;
    const code = legacy ?? (SPOKEN_LANGUAGE_CODE_SET.has(id) ? (id as SpokenLanguageCode) : null);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
