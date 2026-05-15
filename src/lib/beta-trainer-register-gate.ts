import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { getValidBetaInvite, isTrainerBetaCapReached } from "@/lib/beta-waitlist-service";

export type BetaTrainerRegisterGateResult =
  | { ok: true; betaInviteEntryId: string | null }
  | { ok: false; error: string; status: number; code?: string };

export async function evaluateBetaTrainerRegistrationGate(args: {
  serviceZipCode: string;
  email: string;
  username: string;
  betaInviteToken?: string | null;
}): Promise<BetaTrainerRegisterGateResult> {
  if (!isBetaLaunchGatesEnabled()) {
    return { ok: true, betaInviteEntryId: null };
  }
  const zip = args.serviceZipCode.trim();
  if (!zip || !isZipInBetaAtlantaMetroArea(zip)) {
    return {
      ok: false,
      status: 400,
      code: "BETA_OUTSIDE_SERVICE_AREA",
      error: "Enter a valid Atlanta metro ZIP for your primary service area.",
    };
  }
  if (!(await isTrainerBetaCapReached())) {
    return { ok: true, betaInviteEntryId: null };
  }
  const inv = await getValidBetaInvite(args.betaInviteToken ?? undefined);
  const email = args.email.trim().toLowerCase();
  const username = args.username.trim();
  if (!inv || inv.role !== "trainer" || inv.email !== email || inv.desiredUsername !== username) {
    return {
      ok: false,
      status: 403,
      code: "BETA_TRAINER_CAP",
      error: "Coach slots are full for this beta. Join the waitlist and we will email you when a slot opens.",
    };
  }
  return { ok: true, betaInviteEntryId: inv.entryId };
}
