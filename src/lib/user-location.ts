import { z } from "zod";

/**
 * Shared location contract for the worldwide rollout (WP-1).
 *
 * PURE MODULE — no Prisma, no node built-ins, no server-only imports. Safe to
 * import from "use client" components.
 *
 * See docs/WORLDWIDE-ROLLOUT-PLAN.md §1.2.
 */

/** ISO 3166-1 alpha-2 country options with English labels, for country selects. */
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "AF", label: "Afghanistan" },
  { code: "AX", label: "Åland Islands" },
  { code: "AL", label: "Albania" },
  { code: "DZ", label: "Algeria" },
  { code: "AS", label: "American Samoa" },
  { code: "AD", label: "Andorra" },
  { code: "AO", label: "Angola" },
  { code: "AI", label: "Anguilla" },
  { code: "AQ", label: "Antarctica" },
  { code: "AG", label: "Antigua and Barbuda" },
  { code: "AR", label: "Argentina" },
  { code: "AM", label: "Armenia" },
  { code: "AW", label: "Aruba" },
  { code: "AU", label: "Australia" },
  { code: "AT", label: "Austria" },
  { code: "AZ", label: "Azerbaijan" },
  { code: "BS", label: "Bahamas" },
  { code: "BH", label: "Bahrain" },
  { code: "BD", label: "Bangladesh" },
  { code: "BB", label: "Barbados" },
  { code: "BY", label: "Belarus" },
  { code: "BE", label: "Belgium" },
  { code: "BZ", label: "Belize" },
  { code: "BJ", label: "Benin" },
  { code: "BM", label: "Bermuda" },
  { code: "BT", label: "Bhutan" },
  { code: "BO", label: "Bolivia" },
  { code: "BQ", label: "Bonaire, Sint Eustatius and Saba" },
  { code: "BA", label: "Bosnia and Herzegovina" },
  { code: "BW", label: "Botswana" },
  { code: "BV", label: "Bouvet Island" },
  { code: "BR", label: "Brazil" },
  { code: "IO", label: "British Indian Ocean Territory" },
  { code: "BN", label: "Brunei Darussalam" },
  { code: "BG", label: "Bulgaria" },
  { code: "BF", label: "Burkina Faso" },
  { code: "BI", label: "Burundi" },
  { code: "CV", label: "Cabo Verde" },
  { code: "KH", label: "Cambodia" },
  { code: "CM", label: "Cameroon" },
  { code: "CA", label: "Canada" },
  { code: "KY", label: "Cayman Islands" },
  { code: "CF", label: "Central African Republic" },
  { code: "TD", label: "Chad" },
  { code: "CL", label: "Chile" },
  { code: "CN", label: "China" },
  { code: "CX", label: "Christmas Island" },
  { code: "CC", label: "Cocos (Keeling) Islands" },
  { code: "CO", label: "Colombia" },
  { code: "KM", label: "Comoros" },
  { code: "CG", label: "Congo" },
  { code: "CD", label: "Congo, Democratic Republic of the" },
  { code: "CK", label: "Cook Islands" },
  { code: "CR", label: "Costa Rica" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "HR", label: "Croatia" },
  { code: "CU", label: "Cuba" },
  { code: "CW", label: "Curaçao" },
  { code: "CY", label: "Cyprus" },
  { code: "CZ", label: "Czechia" },
  { code: "DK", label: "Denmark" },
  { code: "DJ", label: "Djibouti" },
  { code: "DM", label: "Dominica" },
  { code: "DO", label: "Dominican Republic" },
  { code: "EC", label: "Ecuador" },
  { code: "EG", label: "Egypt" },
  { code: "SV", label: "El Salvador" },
  { code: "GQ", label: "Equatorial Guinea" },
  { code: "ER", label: "Eritrea" },
  { code: "EE", label: "Estonia" },
  { code: "SZ", label: "Eswatini" },
  { code: "ET", label: "Ethiopia" },
  { code: "FK", label: "Falkland Islands (Malvinas)" },
  { code: "FO", label: "Faroe Islands" },
  { code: "FJ", label: "Fiji" },
  { code: "FI", label: "Finland" },
  { code: "FR", label: "France" },
  { code: "GF", label: "French Guiana" },
  { code: "PF", label: "French Polynesia" },
  { code: "TF", label: "French Southern Territories" },
  { code: "GA", label: "Gabon" },
  { code: "GM", label: "Gambia" },
  { code: "GE", label: "Georgia" },
  { code: "DE", label: "Germany" },
  { code: "GH", label: "Ghana" },
  { code: "GI", label: "Gibraltar" },
  { code: "GR", label: "Greece" },
  { code: "GL", label: "Greenland" },
  { code: "GD", label: "Grenada" },
  { code: "GP", label: "Guadeloupe" },
  { code: "GU", label: "Guam" },
  { code: "GT", label: "Guatemala" },
  { code: "GG", label: "Guernsey" },
  { code: "GN", label: "Guinea" },
  { code: "GW", label: "Guinea-Bissau" },
  { code: "GY", label: "Guyana" },
  { code: "HT", label: "Haiti" },
  { code: "HM", label: "Heard Island and McDonald Islands" },
  { code: "VA", label: "Holy See" },
  { code: "HN", label: "Honduras" },
  { code: "HK", label: "Hong Kong" },
  { code: "HU", label: "Hungary" },
  { code: "IS", label: "Iceland" },
  { code: "IN", label: "India" },
  { code: "ID", label: "Indonesia" },
  { code: "IR", label: "Iran" },
  { code: "IQ", label: "Iraq" },
  { code: "IE", label: "Ireland" },
  { code: "IM", label: "Isle of Man" },
  { code: "IL", label: "Israel" },
  { code: "IT", label: "Italy" },
  { code: "JM", label: "Jamaica" },
  { code: "JP", label: "Japan" },
  { code: "JE", label: "Jersey" },
  { code: "JO", label: "Jordan" },
  { code: "KZ", label: "Kazakhstan" },
  { code: "KE", label: "Kenya" },
  { code: "KI", label: "Kiribati" },
  { code: "KP", label: "Korea, Democratic People's Republic of" },
  { code: "KR", label: "Korea, Republic of" },
  { code: "KW", label: "Kuwait" },
  { code: "KG", label: "Kyrgyzstan" },
  { code: "LA", label: "Lao People's Democratic Republic" },
  { code: "LV", label: "Latvia" },
  { code: "LB", label: "Lebanon" },
  { code: "LS", label: "Lesotho" },
  { code: "LR", label: "Liberia" },
  { code: "LY", label: "Libya" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lithuania" },
  { code: "LU", label: "Luxembourg" },
  { code: "MO", label: "Macao" },
  { code: "MG", label: "Madagascar" },
  { code: "MW", label: "Malawi" },
  { code: "MY", label: "Malaysia" },
  { code: "MV", label: "Maldives" },
  { code: "ML", label: "Mali" },
  { code: "MT", label: "Malta" },
  { code: "MH", label: "Marshall Islands" },
  { code: "MQ", label: "Martinique" },
  { code: "MR", label: "Mauritania" },
  { code: "MU", label: "Mauritius" },
  { code: "YT", label: "Mayotte" },
  { code: "MX", label: "Mexico" },
  { code: "FM", label: "Micronesia" },
  { code: "MD", label: "Moldova" },
  { code: "MC", label: "Monaco" },
  { code: "MN", label: "Mongolia" },
  { code: "ME", label: "Montenegro" },
  { code: "MS", label: "Montserrat" },
  { code: "MA", label: "Morocco" },
  { code: "MZ", label: "Mozambique" },
  { code: "MM", label: "Myanmar" },
  { code: "NA", label: "Namibia" },
  { code: "NR", label: "Nauru" },
  { code: "NP", label: "Nepal" },
  { code: "NL", label: "Netherlands" },
  { code: "NC", label: "New Caledonia" },
  { code: "NZ", label: "New Zealand" },
  { code: "NI", label: "Nicaragua" },
  { code: "NE", label: "Niger" },
  { code: "NG", label: "Nigeria" },
  { code: "NU", label: "Niue" },
  { code: "NF", label: "Norfolk Island" },
  { code: "MK", label: "North Macedonia" },
  { code: "MP", label: "Northern Mariana Islands" },
  { code: "NO", label: "Norway" },
  { code: "OM", label: "Oman" },
  { code: "PK", label: "Pakistan" },
  { code: "PW", label: "Palau" },
  { code: "PS", label: "Palestine, State of" },
  { code: "PA", label: "Panama" },
  { code: "PG", label: "Papua New Guinea" },
  { code: "PY", label: "Paraguay" },
  { code: "PE", label: "Peru" },
  { code: "PH", label: "Philippines" },
  { code: "PN", label: "Pitcairn" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "PR", label: "Puerto Rico" },
  { code: "QA", label: "Qatar" },
  { code: "RE", label: "Réunion" },
  { code: "RO", label: "Romania" },
  { code: "RU", label: "Russian Federation" },
  { code: "RW", label: "Rwanda" },
  { code: "BL", label: "Saint Barthélemy" },
  { code: "SH", label: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "KN", label: "Saint Kitts and Nevis" },
  { code: "LC", label: "Saint Lucia" },
  { code: "MF", label: "Saint Martin (French part)" },
  { code: "PM", label: "Saint Pierre and Miquelon" },
  { code: "VC", label: "Saint Vincent and the Grenadines" },
  { code: "WS", label: "Samoa" },
  { code: "SM", label: "San Marino" },
  { code: "ST", label: "Sao Tome and Principe" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "SN", label: "Senegal" },
  { code: "RS", label: "Serbia" },
  { code: "SC", label: "Seychelles" },
  { code: "SL", label: "Sierra Leone" },
  { code: "SG", label: "Singapore" },
  { code: "SX", label: "Sint Maarten (Dutch part)" },
  { code: "SK", label: "Slovakia" },
  { code: "SI", label: "Slovenia" },
  { code: "SB", label: "Solomon Islands" },
  { code: "SO", label: "Somalia" },
  { code: "ZA", label: "South Africa" },
  { code: "GS", label: "South Georgia and the South Sandwich Islands" },
  { code: "SS", label: "South Sudan" },
  { code: "ES", label: "Spain" },
  { code: "LK", label: "Sri Lanka" },
  { code: "SD", label: "Sudan" },
  { code: "SR", label: "Suriname" },
  { code: "SJ", label: "Svalbard and Jan Mayen" },
  { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" },
  { code: "SY", label: "Syrian Arab Republic" },
  { code: "TW", label: "Taiwan" },
  { code: "TJ", label: "Tajikistan" },
  { code: "TZ", label: "Tanzania" },
  { code: "TH", label: "Thailand" },
  { code: "TL", label: "Timor-Leste" },
  { code: "TG", label: "Togo" },
  { code: "TK", label: "Tokelau" },
  { code: "TO", label: "Tonga" },
  { code: "TT", label: "Trinidad and Tobago" },
  { code: "TN", label: "Tunisia" },
  { code: "TR", label: "Türkiye" },
  { code: "TM", label: "Turkmenistan" },
  { code: "TC", label: "Turks and Caicos Islands" },
  { code: "TV", label: "Tuvalu" },
  { code: "UG", label: "Uganda" },
  { code: "UA", label: "Ukraine" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "UM", label: "United States Minor Outlying Islands" },
  { code: "UY", label: "Uruguay" },
  { code: "UZ", label: "Uzbekistan" },
  { code: "VU", label: "Vanuatu" },
  { code: "VE", label: "Venezuela" },
  { code: "VN", label: "Viet Nam" },
  { code: "VG", label: "Virgin Islands (British)" },
  { code: "VI", label: "Virgin Islands (U.S.)" },
  { code: "WF", label: "Wallis and Futuna" },
  { code: "EH", label: "Western Sahara" },
  { code: "YE", label: "Yemen" },
  { code: "ZM", label: "Zambia" },
  { code: "ZW", label: "Zimbabwe" },
];

const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(COUNTRY_OPTIONS.map((c) => c.code));

/** True when `code` is a known ISO 3166-1 alpha-2 code (case-insensitive, trimmed). */
export function isValidCountryCode(code: string): boolean {
  if (typeof code !== "string") return false;
  return COUNTRY_CODE_SET.has(code.trim().toUpperCase());
}

/**
 * Normalize a free-form postal code for storage: trim, collapse inner
 * whitespace to single spaces, uppercase. Returns null when empty or longer
 * than 20 chars after normalization (garbage — postal is optional anyway).
 * NEVER strips non-digits (UK/CA postcodes are alphanumeric).
 */
export function normalizePostalCode(
  countryCode: string | null | undefined,
  raw: string | null | undefined,
): string | null {
  void countryCode; // reserved for future country-specific formatting
  const t = (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return null;
  if (t.length > 20) return null;
  return t;
}

/**
 * Coarse postal region prefix used as the featured-allocation region key.
 *
 * US: first 3 ZIP digits — MUST stay byte-identical to `clientZipToPrefix` in
 * `src/lib/featured-region.ts` (existing `FeaturedDailyAllocation` rows are
 * keyed on that output; any drift orphans live allocations).
 * CA: FSA (first 3 alphanumerics). GB: outward code. Default: first 3
 * alphanumerics, or null when there are fewer than 3.
 */
export function postalRegionPrefix(
  countryCode: string | null | undefined,
  postal: string | null | undefined,
): string | null {
  if (!postal?.trim()) return null;
  const cc = (countryCode ?? "").trim().toUpperCase();

  if (cc === "US") {
    // Byte-identical replica of clientZipToPrefix (src/lib/featured-region.ts).
    const z = postal.replace(/\D/g, "");
    if (z.length < 3) return null;
    return z.slice(0, 3);
  }

  const compact = postal.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cc === "GB") {
    // Outward code: the part before the space; without a space the inward part
    // is always the trailing 3 chars (digit + two letters).
    const spaced = postal.trim().toUpperCase().replace(/\s+/g, " ");
    const outward = spaced.includes(" ")
      ? spaced.slice(0, spaced.indexOf(" "))
      : compact.length > 3
        ? compact.slice(0, compact.length - 3)
        : compact;
    const clean = outward.replace(/[^A-Z0-9]/g, "");
    if (clean.length < 2 || clean.length > 4) return null;
    return clean;
  }

  // CA (FSA) and everywhere else: first 3 alphanumerics.
  if (compact.length < 3) return null;
  return compact.slice(0, 3);
}

/** Client "distance" preference stops — dating-app style, coarse tiers. */
export const LOCATION_SCOPES = ["near_me", "my_country", "worldwide"] as const;

export type LocationScope = (typeof LOCATION_SCOPES)[number];

export const locationScopeSchema = z.enum(LOCATION_SCOPES);

/** Sentence-case UI labels — never show the raw scope value on screen. */
export const LOCATION_SCOPE_LABELS: Record<LocationScope, string> = {
  near_me: "Near me",
  my_country: "My country",
  worldwide: "Worldwide",
};

export type UserLocation = { countryCode: string | null; postalCode: string | null };

/**
 * Pure predicate: does `pro`'s location satisfy the client's `scope`?
 *
 * - `worldwide` → always true (the default; geography narrows, never gates).
 * - `my_country` → both countries known and equal; unknown pro → false.
 * - `near_me` → same country AND same postal region prefix; when either side
 *   has no usable postal prefix it degrades to same-country.
 */
export function locationScopeMatch(
  scope: LocationScope,
  client: UserLocation,
  pro: UserLocation,
): boolean {
  if (scope === "worldwide") return true;

  const clientCountry = (client.countryCode ?? "").trim().toUpperCase();
  const proCountry = (pro.countryCode ?? "").trim().toUpperCase();
  if (!clientCountry || !proCountry || clientCountry !== proCountry) return false;
  if (scope === "my_country") return true;

  // near_me
  const clientPrefix = postalRegionPrefix(clientCountry, client.postalCode);
  const proPrefix = postalRegionPrefix(proCountry, pro.postalCode);
  if (clientPrefix === null || proPrefix === null) return true; // degrade to same-country
  return clientPrefix === proPrefix;
}

/**
 * The region-pool bucket used when a Fitness Pro has no postal code at all.
 * Mirrors `GLOBAL_REGION_KEY` in `@/lib/trainer-promo-tokens`, duplicated here because that
 * module pulls in server-only code and this one must stay importable from client components.
 */
export const GLOBAL_REGION_POOL_KEY = "global";

/**
 * Human label for a featured/promotion region pool.
 *
 * Standing rule: never print a raw database value or internal code on screen. Region keys are
 * either a postal prefix or the literal "global" bucket, and "Region global**" is exactly the
 * kind of leak that rule exists to stop.
 */
export function formatRegionPoolLabel(regionKey: string | null | undefined): string {
  const key = (regionKey ?? "").trim();
  if (!key || key === GLOBAL_REGION_POOL_KEY) return "Worldwide";
  return `${key} area`;
}
