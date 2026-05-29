import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import {
  canReserveTrainerBetaSlots,
  getTrainerBetaSlotSnapshot,
  isValidUsTrainerServiceZip,
  trainerOfferingPrefsFromSignup,
} from "@/lib/beta-trainer-slot-caps";
import { getValidBetaInvite } from "@/lib/beta-waitlist-service";

export type BetaTrainerRegisterGateResult =
  | { ok: true; betaInviteEntryId: string | null; offeringPrefs: ReturnType<typeof trainerOfferingPrefsFromSignup> }
  | { ok: false; error: string; status: number; code?: string };

export async function evaluateBetaTrainerRegistrationGate(args: {
  serviceZipCode: string;
  email: string;
  username: string;
  betaInviteToken?: string | null;
  wantsVirtual?: boolean;
  wantsInPerson?: boolean;
}): Promise<BetaTrainerRegisterGateResult> {
  const offeringPrefs = trainerOfferingPrefsFromSignup({
    wantsVirtual: args.wantsVirtual,
    wantsInPerson: args.wantsInPerson,
  });

  if (!isBetaLaunchGatesEnabled()) {
    return { ok: true, betaInviteEntryId: null, offeringPrefs };
  }

  const zip = args.serviceZipCode.trim();
  if (!zip || !isValidUsTrainerServiceZip(zip)) {
    return {
      ok: false,
      status: 400,
      code: "BETA_INVALID_SERVICE_ZIP",
      error: "Enter a valid US ZIP code for your primary service area.",
    };
  }

  if (offeringPrefs.wantsInPerson && !isZipInBetaAtlantaMetroArea(zip)) {
    return {
      ok: false,
      status: 400,
      code: "BETA_OUTSIDE_IN_PERSON_AREA",
      error: "In-person offerings require a ZIP inside the Atlanta metro beta area.",
    };
  }

  const snapshot = await getTrainerBetaSlotSnapshot();
  const reserve = canReserveTrainerBetaSlots(snapshot, offeringPrefs);
  if (reserve.ok) {
    return { ok: true, betaInviteEntryId: null, offeringPrefs };
  }

  const inv = await getValidBetaInvite(args.betaInviteToken ?? undefined);
  const email = args.email.trim().toLowerCase();
  const username = args.username.trim();
  if (!inv || inv.role !== "trainer" || inv.email !== email || inv.desiredUsername !== username) {
    if (reserve.reason === "in_person") {
      return {
        ok: false,
        status: 403,
        code: "BETA_TRAINER_IN_PERSON_CAP",
        error: "In-person coach slots are full. You can sign up for virtual-only offerings or join the in-person waitlist.",
      };
    }
    if (reserve.reason === "virtual") {
      return {
        ok: false,
        status: 403,
        code: "BETA_TRAINER_VIRTUAL_CAP",
        error: "Virtual coach slots are full for this beta. Join the waitlist and we will email you when a slot opens.",
      };
    }
    return {
      ok: false,
      status: 403,
      code: "BETA_TRAINER_CAP",
      error: "Coach slots are full for this beta. Join the waitlist and we will email you when a slot opens.",
    };
  }

  const invitePrefs = {
    wantsVirtual: inv.desiredOfferingVirtual,
    wantsInPerson: inv.desiredOfferingInPerson,
  };
  const inviteReserve = canReserveTrainerBetaSlots(snapshot, invitePrefs);
  if (!inviteReserve.ok) {
    return {
      ok: false,
      status: 403,
      code: "BETA_TRAINER_CAP",
      error: "Your reserved invite no longer matches open capacity. Contact support@match-fit.net.",
    };
  }

  const coversVirtual = !offeringPrefs.wantsVirtual || invitePrefs.wantsVirtual;
  const coversInPerson = !offeringPrefs.wantsInPerson || invitePrefs.wantsInPerson;
  if (!coversVirtual || !coversInPerson) {
    return {
      ok: false,
      status: 403,
      code: "BETA_TRAINER_CAP",
      error: "Your invite covers different offering types than you selected. Adjust your selections or contact support.",
    };
  }

  return { ok: true, betaInviteEntryId: inv.entryId, offeringPrefs };
}
