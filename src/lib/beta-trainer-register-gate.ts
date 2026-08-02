import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { getValidBetaInvite, isTrainerBetaCapReached } from "@/lib/beta-waitlist-service";

export type BetaTrainerRegisterGateResult =
  | { ok: true; betaInviteEntryId: string | null }
  | { ok: false; error: string; status: number; code?: string };

/**
 * Match Fit went worldwide 2026-07-31 (JB decision). This gate used to hard-require a valid
 * US ZIP code for EVERY trainer registration, which meant a non-US trainer (or a US trainer
 * offering virtual-only coaching who just left the field blank) could not even create an
 * account. The US-zip check now lives only where it belongs: computing in-person / Atlanta
 * metro eligibility (see trainer-in-person-service-area.ts,
 * zipSupportsTrainerInPersonServices). Any location value, or none at all, is accepted here —
 * a trainer with no matching US zip simply shows as virtual-only / worldwide, not blocked.
 */
export async function evaluateBetaTrainerRegistrationGate(args: {
  serviceZipCode: string;
  email: string;
  username: string;
  betaInviteToken?: string | null;
}): Promise<BetaTrainerRegisterGateResult> {
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
