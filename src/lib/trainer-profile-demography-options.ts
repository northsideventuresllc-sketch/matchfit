/** Shown under demographic controls — stored values match option labels (case-sensitive). */
export const TRAINER_DEMOGRAPHY_CASE_NOTE =
  "Your answers are saved exactly as shown, including spelling and capitalization.";

export const TRAINER_PRONOUN_CUSTOM = "__custom__" as const;

/** `value` is persisted verbatim when chosen (case-sensitive). */
export const TRAINER_PRONOUN_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "she/her", label: "she/her" },
  { value: "he/him", label: "he/him" },
  { value: "they/them", label: "they/them" },
  { value: "she/they", label: "she/they" },
  { value: "he/they", label: "he/they" },
  { value: "xe/xem", label: "xe/xem" },
  { value: "ey/em", label: "ey/em" },
  { value: "Use my name only", label: "Use my name only" },
  { value: TRAINER_PRONOUN_CUSTOM, label: "Custom (type below)" },
];

export const TRAINER_PRONOUN_PRESET_VALUES = new Set(
  TRAINER_PRONOUN_CHOICES.map((c) => c.value).filter((v) => v && v !== TRAINER_PRONOUN_CUSTOM),
);

export function trainerPronounsSelectValue(stored: string): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  if (TRAINER_PRONOUN_PRESET_VALUES.has(s)) return s;
  return TRAINER_PRONOUN_CUSTOM;
}

export const TRAINER_ETHNICITY_CUSTOM = "__custom__" as const;

export const TRAINER_ETHNICITY_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "Hispanic or Latino", label: "Hispanic or Latino" },
  { value: "Not Hispanic or Latino", label: "Not Hispanic or Latino" },
  { value: "American Indian or Alaska Native", label: "American Indian or Alaska Native" },
  { value: "Asian", label: "Asian" },
  { value: "Black or African American", label: "Black or African American" },
  { value: "Native Hawaiian or Other Pacific Islander", label: "Native Hawaiian or Other Pacific Islander" },
  { value: "White", label: "White" },
  { value: "Middle Eastern or North African", label: "Middle Eastern or North African" },
  { value: "Two or more races", label: "Two or more races" },
  { value: TRAINER_ETHNICITY_CUSTOM, label: "Custom (type below)" },
];

export const TRAINER_ETHNICITY_PRESET_VALUES = new Set(
  TRAINER_ETHNICITY_CHOICES.map((c) => c.value).filter((v) => v && v !== TRAINER_ETHNICITY_CUSTOM),
);

export function trainerEthnicitySelectValue(stored: string): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  if (TRAINER_ETHNICITY_PRESET_VALUES.has(s)) return s;
  return TRAINER_ETHNICITY_CUSTOM;
}

export const TRAINER_GENDER_CUSTOM = "__custom__" as const;

export const TRAINER_GENDER_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "Woman", label: "Woman" },
  { value: "Man", label: "Man" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "Transgender Woman", label: "Transgender Woman" },
  { value: "Transgender Man", label: "Transgender Man" },
  { value: "Genderqueer or gender-expansive", label: "Genderqueer or gender-expansive" },
  { value: TRAINER_GENDER_CUSTOM, label: "Custom (type below)" },
];

export const TRAINER_GENDER_PRESET_VALUES = new Set(
  TRAINER_GENDER_CHOICES.map((c) => c.value).filter((v) => v && v !== TRAINER_GENDER_CUSTOM),
);

export function trainerGenderSelectValue(stored: string): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  if (TRAINER_GENDER_PRESET_VALUES.has(s)) return s;
  return TRAINER_GENDER_CUSTOM;
}

export const TRAINER_YEARS_COACHING_CUSTOM = "__custom__" as const;

/** Stored as string in Trainer profile (e.g. "5", "31+"). */
export const TRAINER_YEARS_COACHING_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i),
    label: i === 0 ? "Less than 1 year" : i === 1 ? "1 year" : `${i} years`,
  })),
  { value: "31+", label: "31 or more years" },
  { value: TRAINER_YEARS_COACHING_CUSTOM, label: "Custom (type below)" },
];

export const TRAINER_YEARS_COACHING_PRESET_VALUES = new Set(
  TRAINER_YEARS_COACHING_CHOICES.map((c) => c.value).filter((v) => v && v !== TRAINER_YEARS_COACHING_CUSTOM),
);

export function trainerYearsCoachingSelectValue(stored: string): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  if (TRAINER_YEARS_COACHING_PRESET_VALUES.has(s)) return s;
  return TRAINER_YEARS_COACHING_CUSTOM;
}

/** Match questionnaire `yearsCoaching` is numeric 0–60 — same menu as profile for consistency. */
export const MATCH_QUESTIONNAIRE_YEARS_COACHING_MAX = 60;

/** USPS two-letter codes — `value` is stored in uppercase (IRS-style). */
export const US_STATE_POSTAL_OPTIONS: { value: string; label: string }[] = [
  { value: "AL", label: "AL — Alabama" },
  { value: "AK", label: "AK — Alaska" },
  { value: "AZ", label: "AZ — Arizona" },
  { value: "AR", label: "AR — Arkansas" },
  { value: "CA", label: "CA — California" },
  { value: "CO", label: "CO — Colorado" },
  { value: "CT", label: "CT — Connecticut" },
  { value: "DE", label: "DE — Delaware" },
  { value: "DC", label: "DC — District of Columbia" },
  { value: "FL", label: "FL — Florida" },
  { value: "GA", label: "GA — Georgia" },
  { value: "HI", label: "HI — Hawaii" },
  { value: "ID", label: "ID — Idaho" },
  { value: "IL", label: "IL — Illinois" },
  { value: "IN", label: "IN — Indiana" },
  { value: "IA", label: "IA — Iowa" },
  { value: "KS", label: "KS — Kansas" },
  { value: "KY", label: "KY — Kentucky" },
  { value: "LA", label: "LA — Louisiana" },
  { value: "ME", label: "ME — Maine" },
  { value: "MD", label: "MD — Maryland" },
  { value: "MA", label: "MA — Massachusetts" },
  { value: "MI", label: "MI — Michigan" },
  { value: "MN", label: "MN — Minnesota" },
  { value: "MS", label: "MS — Mississippi" },
  { value: "MO", label: "MO — Missouri" },
  { value: "MT", label: "MT — Montana" },
  { value: "NE", label: "NE — Nebraska" },
  { value: "NV", label: "NV — Nevada" },
  { value: "NH", label: "NH — New Hampshire" },
  { value: "NJ", label: "NJ — New Jersey" },
  { value: "NM", label: "NM — New Mexico" },
  { value: "NY", label: "NY — New York" },
  { value: "NC", label: "NC — North Carolina" },
  { value: "ND", label: "ND — North Dakota" },
  { value: "OH", label: "OH — Ohio" },
  { value: "OK", label: "OK — Oklahoma" },
  { value: "OR", label: "OR — Oregon" },
  { value: "PA", label: "PA — Pennsylvania" },
  { value: "RI", label: "RI — Rhode Island" },
  { value: "SC", label: "SC — South Carolina" },
  { value: "SD", label: "SD — South Dakota" },
  { value: "TN", label: "TN — Tennessee" },
  { value: "TX", label: "TX — Texas" },
  { value: "UT", label: "UT — Utah" },
  { value: "VT", label: "VT — Vermont" },
  { value: "VA", label: "VA — Virginia" },
  { value: "WA", label: "WA — Washington" },
  { value: "WV", label: "WV — West Virginia" },
  { value: "WI", label: "WI — Wisconsin" },
  { value: "WY", label: "WY — Wyoming" },
];
