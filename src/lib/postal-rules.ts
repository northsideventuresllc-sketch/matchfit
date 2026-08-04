/**
 * Country-aware postal address rules.
 *
 * Match Fit is worldwide (NI-Brain Decision #452), so a single "ZIP code" box is wrong in most
 * of the world. What a postal code is CALLED, whether it is REQUIRED, and whether the country
 * has one AT ALL all vary — several countries on the first-tier marketing list (notably the
 * United Arab Emirates) have no postal code system, so asking for one is a dead field the user
 * cannot fill.
 *
 * Consumers use `postalRuleForCountry` to decide:
 *   - `requirement: "none"`   -> do not render the field at all (also the DEFAULT for any
 *     country we have no rule for — we ask nothing rather than show a vague optional box)
 *   - `requirement: "optional"` -> render, never block submission
 *   - `requirement: "required"` -> render and validate
 *
 * Pure module: no Prisma, no network, no node built-ins — safe to import from client components.
 * Nothing here calls a paid service; the data is a static table.
 */

export type PostalRequirement = "required" | "optional" | "none";

export type PostalRule = {
  requirement: PostalRequirement;
  /** User-facing field label. Sentence case except where the local term is a proper noun. */
  label: string;
  /** Example value shown as a placeholder. Empty when the country has no postal system. */
  example: string;
  /** Optional format check. Absent means "accept anything non-empty". */
  pattern?: RegExp;
};

/**
 * Countries with NO postal code system in general use (Universal Postal Union).
 * For these the postal question is SKIPPED entirely — that is the whole point of this table.
 * `AE` and `HK` matter most here: both are commercially significant and both are postal-code-free.
 */
const NO_POSTAL_SYSTEM = new Set([
  "AE", "AO", "AG", "AW", "BS", "BZ", "BJ", "BW", "BF", "BI", "CM", "CF", "TD", "KM", "CG", "CD",
  "CK", "CI", "DJ", "DM", "GQ", "ER", "FJ", "GM", "GH", "GD", "GY", "HK", "JM", "KI", "LY", "MO",
  "MW", "ML", "MR", "NR", "QA", "RW", "KN", "LC", "VC", "ST", "SC", "SL", "SB", "SO", "SR", "SY",
  "TZ", "TL", "TG", "TK", "TO", "TV", "UG", "VU", "YE", "ZW",
]);

/** Per-country overrides. Anything not listed falls back to the sensible default below. */
const POSTAL_RULES: Record<string, PostalRule> = {
  US: { requirement: "required", label: "ZIP code", example: "30301", pattern: /^\d{5}(-\d{4})?$/ },
  CA: {
    requirement: "required",
    label: "Postal code",
    example: "V6B 1A1",
    pattern: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
  },
  GB: {
    requirement: "required",
    label: "Postcode",
    example: "SW1A 1AA",
    pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
  },
  // Eircode only reached full rollout in 2015 and many people still do not know theirs.
  IE: { requirement: "optional", label: "Eircode", example: "D02 AF30" },
  AU: { requirement: "required", label: "Postcode", example: "2000", pattern: /^\d{4}$/ },
  NZ: { requirement: "required", label: "Postcode", example: "6011", pattern: /^\d{4}$/ },
  DE: { requirement: "required", label: "Postal code", example: "10115", pattern: /^\d{5}$/ },
  FR: { requirement: "required", label: "Postal code", example: "75001", pattern: /^\d{5}$/ },
  ES: { requirement: "required", label: "Postal code", example: "28001", pattern: /^\d{5}$/ },
  IT: { requirement: "required", label: "Postal code", example: "00100", pattern: /^\d{5}$/ },
  NL: {
    requirement: "required",
    label: "Postcode",
    example: "1012 AB",
    pattern: /^\d{4} ?[A-Za-z]{2}$/,
  },
  BE: { requirement: "required", label: "Postal code", example: "1000", pattern: /^\d{4}$/ },
  AT: { requirement: "required", label: "Postal code", example: "1010", pattern: /^\d{4}$/ },
  CH: { requirement: "required", label: "Postal code", example: "8001", pattern: /^\d{4}$/ },
  DK: { requirement: "required", label: "Postal code", example: "1050", pattern: /^\d{4}$/ },
  NO: { requirement: "required", label: "Postal code", example: "0150", pattern: /^\d{4}$/ },
  SE: { requirement: "required", label: "Postal code", example: "111 29", pattern: /^\d{3} ?\d{2}$/ },
  FI: { requirement: "required", label: "Postal code", example: "00100", pattern: /^\d{5}$/ },
  PL: { requirement: "required", label: "Postal code", example: "00-001", pattern: /^\d{2}-\d{3}$/ },
  PT: { requirement: "required", label: "Postal code", example: "1000-001", pattern: /^\d{4}-\d{3}$/ },
  SG: { requirement: "required", label: "Postal code", example: "018956", pattern: /^\d{6}$/ },
  IN: { requirement: "required", label: "PIN code", example: "110001", pattern: /^\d{6}$/ },
  BR: { requirement: "required", label: "CEP", example: "01310-100", pattern: /^\d{5}-?\d{3}$/ },
  JP: { requirement: "required", label: "Postal code", example: "100-0001", pattern: /^\d{3}-?\d{4}$/ },
  MX: { requirement: "required", label: "Postal code", example: "06000", pattern: /^\d{5}$/ },
  ZA: { requirement: "required", label: "Postal code", example: "8001", pattern: /^\d{4}$/ },
  CN: { requirement: "required", label: "Postal code", example: "100000", pattern: /^\d{6}$/ },
  KR: { requirement: "required", label: "Postal code", example: "04524", pattern: /^\d{5}$/ },
};

/**
 * Unlisted countries: ask NOTHING.
 *
 * JB's ruling — keep the process simple. If we do not know what a country calls its postal
 * code, what shape it takes, or whether it even has one, showing a vague "Postal code
 * (optional)" box is friction that buys nothing: the user does not know whether to fill it,
 * and we cannot validate or usefully use what they type.
 *
 * The cost is bounded and graceful. A postal code is only ever used to sharpen the "near me"
 * discovery preference; with no postal, `postalRegionPrefix` returns null and
 * `locationScopeMatch` already degrades "near me" to same-country matching. Nothing breaks,
 * nothing is gated, and the signup stays one question shorter.
 *
 * To start collecting a postal for a country, add it to POSTAL_RULES above — that is the only
 * change required.
 */
const DEFAULT_RULE: PostalRule = {
  requirement: "none",
  label: "Postal code",
  example: "",
};

const NO_POSTAL_RULE: PostalRule = {
  requirement: "none",
  label: "Postal code",
  example: "",
};

export function postalRuleForCountry(countryCode: string | null | undefined): PostalRule {
  const code = (countryCode ?? "").trim().toUpperCase();
  if (!code) return DEFAULT_RULE;
  if (NO_POSTAL_SYSTEM.has(code)) return NO_POSTAL_RULE;
  return POSTAL_RULES[code] ?? DEFAULT_RULE;
}

/** True when the postal question should be rendered at all. */
export function countryUsesPostalCode(countryCode: string | null | undefined): boolean {
  return postalRuleForCountry(countryCode).requirement !== "none";
}

/**
 * Validate a postal value for a country.
 * Returns a sentence-case error message, or null when the value is acceptable.
 */
export function postalValidationError(
  countryCode: string | null | undefined,
  raw: string | null | undefined,
): string | null {
  const rule = postalRuleForCountry(countryCode);
  const value = (raw ?? "").trim();

  if (rule.requirement === "none") return null;
  if (!value) {
    return rule.requirement === "required" ? `Enter your ${rule.label.toLowerCase()}.` : null;
  }
  if (value.length > 20) return `That ${rule.label.toLowerCase()} is too long.`;
  if (rule.pattern && !rule.pattern.test(value)) {
    return rule.example
      ? `Enter a valid ${rule.label.toLowerCase()} (for example ${rule.example}).`
      : `Enter a valid ${rule.label.toLowerCase()}.`;
  }
  return null;
}
