import type { ClientMatchPreferences } from "@/lib/client-match-preferences";
import {
  clientPreferenceSearchTokens,
  deliveryModeMatchesTrainerText,
  trainerMatchesServiceTypes,
} from "@/lib/client-match-preferences";

export type TrainerIdealHaystackSource = {
  fitnessNiches: string | null;
  aiMatchProfileText: string | null;
  profile: { onboardingTrackCpt: boolean; onboardingTrackNutrition: boolean };
};

/** How strongly the client’s stated preferences overlap the trainer’s published “ideal client” text. */
export function scoreClientForTrainerIdeal(
  trainer: TrainerIdealHaystackSource,
  prefs: ClientMatchPreferences,
): { score: number; nicheHits: number; serviceOk: boolean; deliveryOk: boolean } {
  const trainerHaystack = `${trainer.fitnessNiches ?? ""} ${trainer.aiMatchProfileText ?? ""}`.toLowerCase();
  const tokens = clientPreferenceSearchTokens(prefs);
  let nicheHits = 0;
  for (const t of tokens) {
    if (t.length > 2 && trainerHaystack.includes(t)) nicheHits += 1;
  }
  const serviceOk = trainerMatchesServiceTypes(prefs, trainer.profile);
  const deliveryOk = deliveryModeMatchesTrainerText(prefs.deliveryModes, trainerHaystack);
  let score = nicheHits * 4;
  if (serviceOk) score += 10;
  if (deliveryOk) score += 8;
  return { score, nicheHits, serviceOk, deliveryOk };
}
