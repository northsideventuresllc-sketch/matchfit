import { z } from "zod";
import {
  trainerOffersNutritionServices,
  trainerOffersPersonalTrainingServices,
  type TrainerServiceBucketProfile,
} from "@/lib/trainer-service-buckets";

export const SERVICE_TYPES = ["personal_training", "nutrition"] as const;
export const DELIVERY_MODES = ["in_person", "mobile", "virtual", "diy", "nutrition_planning"] as const;

export const clientMatchPreferencesSchema = z.object({
  goals: z.string().max(2000).default(""),
  serviceTypes: z.array(z.enum(SERVICE_TYPES)).min(1, "Pick at least one service type."),
  deliveryModes: z.array(z.enum(DELIVERY_MODES)).min(1, "Pick at least one way you want to work together."),
  /** Comma-separated or short phrases; normalized to lowercase tokens for matching. */
  fitnessNiches: z.string().max(1000).default(""),
  /** When searching, also surface coaches slightly outside strict preference fit. */
  allowRelaxedSearchDefault: z.boolean().default(true),
});

export type ClientMatchPreferences = z.infer<typeof clientMatchPreferencesSchema>;

export const defaultClientMatchPreferences: ClientMatchPreferences = {
  goals: "",
  serviceTypes: ["personal_training"],
  deliveryModes: ["virtual"],
  fitnessNiches: "",
  allowRelaxedSearchDefault: true,
};

export function parseClientMatchPreferencesJson(raw: string | null | undefined): ClientMatchPreferences {
  if (!raw?.trim()) {
    return { ...defaultClientMatchPreferences };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const r = clientMatchPreferencesSchema.safeParse(parsed);
    if (!r.success) {
      return { ...defaultClientMatchPreferences };
    }
    return r.data;
  } catch {
    return { ...defaultClientMatchPreferences };
  }
}

export function serializeClientMatchPreferences(p: ClientMatchPreferences): string {
  return JSON.stringify(clientMatchPreferencesSchema.parse(p));
}

function nicheTokens(niches: string): string[] {
  return niches
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tokens from goals + niches for haystack matching. */
export function clientPreferenceSearchTokens(prefs: ClientMatchPreferences): string[] {
  const fromGoals = prefs.goals
    .toLowerCase()
    .split(/\W+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return [...new Set([...nicheTokens(prefs.fitnessNiches), ...fromGoals])].slice(0, 40);
}

const DELIVERY_KEYWORDS: Record<(typeof DELIVERY_MODES)[number], string[]> = {
  in_person: ["in person", "in-person", "inperson", "studio", "gym session", "onsite"],
  mobile: ["mobile", "travel", "house call", "home visit", "come to you"],
  virtual: ["virtual", "online", "remote", "zoom", "video"],
  diy: ["diy", "self guided", "program only", "template", "on your own"],
  nutrition_planning: ["meal plan", "nutrition plan", "macros", "diet plan", "nutrition coaching"],
};

export function deliveryModeMatchesTrainerText(
  modes: (typeof DELIVERY_MODES)[number][],
  trainerHaystack: string,
): boolean {
  if (!modes.length) return true;
  const h = trainerHaystack.toLowerCase();
  return modes.some((mode) => DELIVERY_KEYWORDS[mode].some((kw) => h.includes(kw)));
}

export function trainerMatchesServiceTypes(
  prefs: ClientMatchPreferences,
  trainerProfile: TrainerServiceBucketProfile,
): boolean {
  const wantsPt = prefs.serviceTypes.includes("personal_training");
  const wantsNut = prefs.serviceTypes.includes("nutrition");
  const okPt = wantsPt && trainerOffersPersonalTrainingServices(trainerProfile);
  const okNut = wantsNut && trainerOffersNutritionServices(trainerProfile);
  return okPt || okNut;
}

export function scoreTrainerForClientPrefs(
  prefs: ClientMatchPreferences,
  trainer: {
    fitnessNiches: string | null;
    aiMatchProfileText: string | null;
    profile: TrainerServiceBucketProfile;
  },
): { score: number; nicheHits: number; serviceOk: boolean; deliveryOk: boolean } {
  const haystack = `${trainer.fitnessNiches ?? ""} ${trainer.aiMatchProfileText ?? ""}`.toLowerCase();
  const tokens = clientPreferenceSearchTokens(prefs);
  let nicheHits = 0;
  for (const t of tokens) {
    if (t.length > 2 && haystack.includes(t)) nicheHits += 1;
  }
  const serviceOk = trainerMatchesServiceTypes(prefs, trainer.profile);
  const deliveryOk = deliveryModeMatchesTrainerText(prefs.deliveryModes, haystack);
  let score = nicheHits * 4;
  if (serviceOk) score += 10;
  if (deliveryOk) score += 8;
  return { score, nicheHits, serviceOk, deliveryOk };
}

export function trainerPassesStrictBrowse(
  prefs: ClientMatchPreferences,
  metrics: { nicheHits: number; serviceOk: boolean; deliveryOk: boolean },
): boolean {
  if (!metrics.serviceOk) return false;
  if (!metrics.deliveryOk) return false;
  const tokens = clientPreferenceSearchTokens(prefs);
  if (tokens.length > 0 && metrics.nicheHits === 0) return false;
  return true;
}
