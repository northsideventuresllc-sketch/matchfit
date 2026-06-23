import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { isValidUsServiceZip } from "@/lib/trainer-in-person-service-area";
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
  const zip = args.serviceZipCode.trim();
  if (!zip || !isValidUsServiceZip(zip)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_SERVICE_ZIP",
      error: "Enter a valid US ZIP code (5 digits) for your primary service area.",
    };
  }

  if (!isBetaLaunchGatesEnabled()) {
    return { ok: true, betaInviteEntryId: null };
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
      error: "Fitness Pro slots are full for this beta. Join the waitlist and we will email you when a slot opens.",
    };
  }
  return { ok: true, betaInviteEntryId: inv.entryId };
}
