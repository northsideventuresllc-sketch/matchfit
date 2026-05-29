import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";

export const BETA_IN_PERSON_ZIP_OUTSIDE_AREA_MESSAGE =
  "In-person services are only available within the Atlanta metro beta area during this rollout.";

export const BETA_IN_PERSON_TRAINER_SLOT_REQUIRED_MESSAGE =
  "In-person offerings require opting in during coach sign-up while in-person slots are available.";

export function betaInPersonGeoGateActive(): boolean {
  return isBetaLaunchGatesEnabled();
}

export function zipEligibleForBetaInPersonServices(zip: string | null | undefined): boolean {
  if (!betaInPersonGeoGateActive()) return true;
  return isZipInBetaAtlantaMetroArea(zip ?? "");
}

export function validateBetaInPersonServiceZip(
  zip: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!betaInPersonGeoGateActive()) return { ok: true };
  const trimmed = zip?.trim() ?? "";
  if (!/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid US ZIP for in-person service coverage." };
  }
  if (!isZipInBetaAtlantaMetroArea(trimmed)) {
    return { ok: false, error: BETA_IN_PERSON_ZIP_OUTSIDE_AREA_MESSAGE };
  }
  return { ok: true };
}

export function validateBetaInPersonParticipantZips(args: {
  clientZip: string | null | undefined;
  trainerServiceZip: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (!betaInPersonGeoGateActive()) return { ok: true };
  if (!zipEligibleForBetaInPersonServices(args.clientZip)) {
    return {
      ok: false,
      error: "In-person sessions require a client home ZIP inside the Atlanta metro beta area during this rollout.",
    };
  }
  const trainerCheck = validateBetaInPersonServiceZip(args.trainerServiceZip);
  if (!trainerCheck.ok) return trainerCheck;
  return { ok: true };
}
