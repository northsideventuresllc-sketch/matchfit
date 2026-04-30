import type { ClientMatchPreferences } from "@/lib/client-match-preferences";
import { scoreTrainerForClientPrefs } from "@/lib/client-match-preferences";
import type { TrainerServiceBucketProfile } from "@/lib/trainer-service-buckets";

export type TrainerIdealHaystackSource = {
  fitnessNiches: string | null;
  aiMatchProfileText: string | null;
  profile: TrainerServiceBucketProfile;
};

/** How strongly the client’s stated preferences overlap the trainer’s published “ideal client” text. */
export function scoreClientForTrainerIdeal(
  trainer: TrainerIdealHaystackSource,
  prefs: ClientMatchPreferences,
): { score: number; nicheHits: number; serviceOk: boolean; deliveryOk: boolean } {
  return scoreTrainerForClientPrefs(prefs, trainer);
}
