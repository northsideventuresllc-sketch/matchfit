import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { getValidBetaInvite, isClientBetaCapReached } from "@/lib/beta-waitlist-service";

export type BetaClientRegisterGateResult =
  | { ok: true; betaClientWaitlistEntryId: string | null }
  | { ok: false; error: string; status: number; code?: string };

export async function evaluateBetaClientRegistrationGate(args: {
  zipCode: string;
  email: string;
  username: string;
  betaInviteToken?: string | null;
}): Promise<BetaClientRegisterGateResult> {
  if (!isBetaLaunchGatesEnabled()) {
    return { ok: true, betaClientWaitlistEntryId: null };
  }
  if (!isZipInBetaAtlantaMetroArea(args.zipCode)) {
    return {
      ok: false,
      status: 400,
      code: "BETA_OUTSIDE_SERVICE_AREA",
      error: "Match Fit beta is limited to the Atlanta metro area. Check your ZIP code.",
    };
  }
  if (!(await isClientBetaCapReached())) {
    return { ok: true, betaClientWaitlistEntryId: null };
  }
  const inv = await getValidBetaInvite(args.betaInviteToken ?? undefined);
  const email = args.email.trim().toLowerCase();
  const username = args.username.trim();
  if (!inv || inv.role !== "client" || inv.email !== email || inv.desiredUsername !== username) {
    return {
      ok: false,
      status: 403,
      code: "BETA_CLIENT_CAP",
      error: "Client memberships are full for this beta. Join the waitlist and we will email you when a slot opens.",
    };
  }
  return { ok: true, betaClientWaitlistEntryId: inv.entryId };
}
