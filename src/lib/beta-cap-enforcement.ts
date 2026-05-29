import {
  betaMaxClients,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import {
  canReserveTrainerBetaSlots,
  getTrainerBetaSlotSnapshot,
  type TrainerBetaOfferingPrefs,
} from "@/lib/beta-trainer-slot-caps";
import {
  countLaunchClientsInTx,
} from "@/lib/launch-account-counts";
import {
  clientBetaSlotsUsed,
  countActiveClientBetaInvites,
  getTrainerBetaSlotSnapshotInTx,
} from "@/lib/beta-waitlist-service";
import type { Prisma } from "@/generated/prisma/client";

export { countLaunchTrainersInTx, countLaunchClientsInTx } from "@/lib/launch-account-counts";

export class BetaCapExceededError extends Error {
  readonly code: "BETA_TRAINER_CAP" | "BETA_CLIENT_CAP" | "BETA_TRAINER_VIRTUAL_CAP" | "BETA_TRAINER_IN_PERSON_CAP";

  constructor(
    message: string,
    code: "BETA_TRAINER_CAP" | "BETA_CLIENT_CAP" | "BETA_TRAINER_VIRTUAL_CAP" | "BETA_TRAINER_IN_PERSON_CAP",
  ) {
    super(message);
    this.name = "BetaCapExceededError";
    this.code = code;
  }
}

async function clientSlotsUsedInTx(tx: Prisma.TransactionClient): Promise<number> {
  const [registered, invited] = await Promise.all([
    countLaunchClientsInTx(tx),
    countActiveClientBetaInvites(tx),
  ]);
  return registered + invited;
}

async function validTrainerInviteInTx(
  tx: Prisma.TransactionClient,
  betaInviteEntryId: string | null,
): Promise<{ id: string; desiredOfferingVirtual: boolean; desiredOfferingInPerson: boolean } | null> {
  if (!betaInviteEntryId) return null;
  return tx.betaTrainerWaitlistEntry.findFirst({
    where: {
      id: betaInviteEntryId,
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      desiredOfferingVirtual: true,
      desiredOfferingInPerson: true,
    },
  });
}

function trainerCapErrorMessage(reason: "total" | "virtual" | "in_person"): string {
  if (reason === "virtual") {
    return "Virtual coach slots are full for this beta. Join the waitlist and we will email you when a virtual slot opens.";
  }
  if (reason === "in_person") {
    return "In-person coach slots are full for this beta. Join the waitlist and we will email you when an in-person slot opens.";
  }
  return "Coach slots are full for this beta. Join the waitlist and we will email you when a slot opens.";
}

function trainerCapErrorCode(
  reason: "total" | "virtual" | "in_person",
): "BETA_TRAINER_CAP" | "BETA_TRAINER_VIRTUAL_CAP" | "BETA_TRAINER_IN_PERSON_CAP" {
  if (reason === "virtual") return "BETA_TRAINER_VIRTUAL_CAP";
  if (reason === "in_person") return "BETA_TRAINER_IN_PERSON_CAP";
  return "BETA_TRAINER_CAP";
}

/** Re-check cap inside a transaction before creating a trainer (closes signup races). */
export async function assertTrainerBetaSlotInTransaction(
  tx: Prisma.TransactionClient,
  betaInviteEntryId: string | null,
  prefs: TrainerBetaOfferingPrefs,
): Promise<void> {
  if (!isBetaLaunchGatesEnabled()) return;

  const snapshot = await getTrainerBetaSlotSnapshotInTx(tx);
  const reserve = canReserveTrainerBetaSlots(snapshot, prefs);
  if (reserve.ok) return;

  const invite = await validTrainerInviteInTx(tx, betaInviteEntryId);
  if (invite) {
    const invitePrefs = {
      wantsVirtual: invite.desiredOfferingVirtual,
      wantsInPerson: invite.desiredOfferingInPerson,
    };
    const inviteReserve = canReserveTrainerBetaSlots(snapshot, invitePrefs);
    if (inviteReserve.ok) {
      const coversVirtual = !prefs.wantsVirtual || invitePrefs.wantsVirtual;
      const coversInPerson = !prefs.wantsInPerson || invitePrefs.wantsInPerson;
      if (coversVirtual && coversInPerson) return;
    }
  }

  const reason = reserve.reason === "none" ? "total" : reserve.reason;
  throw new BetaCapExceededError(trainerCapErrorMessage(reason), trainerCapErrorCode(reason));
}

/** Re-check cap inside a transaction before reserving a client registration hold. */
export async function assertClientBetaSlotInTransaction(
  tx: Prisma.TransactionClient,
  betaClientWaitlistEntryId: string | null,
): Promise<void> {
  if (!isBetaLaunchGatesEnabled()) return;
  const used = await clientSlotsUsedInTx(tx);
  const max = betaMaxClients();
  if (used < max) return;
  if (betaClientWaitlistEntryId) {
    const invite = await tx.betaClientWaitlistEntry.findFirst({
      where: {
        id: betaClientWaitlistEntryId,
        status: "INVITED",
        slotExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (invite) return;
  }
  throw new BetaCapExceededError(
    "Client memberships are full for this beta. Join the waitlist and we will email you when a slot opens.",
    "BETA_CLIENT_CAP",
  );
}

/** Re-check cap inside finalize transaction (hold may have been created before cap filled). */
export async function assertClientBetaSlotForFinalize(
  tx: Prisma.TransactionClient,
  betaClientWaitlistEntryId: string | null,
): Promise<void> {
  await assertClientBetaSlotInTransaction(tx, betaClientWaitlistEntryId);
}

/** Quick pre-flight without transaction (used outside create paths). */
export async function trainerBetaSlotsAvailable(): Promise<number> {
  if (!isBetaLaunchGatesEnabled()) return Number.POSITIVE_INFINITY;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.totalRemaining;
}

export async function clientBetaSlotsAvailable(): Promise<number> {
  if (!isBetaLaunchGatesEnabled()) return Number.POSITIVE_INFINITY;
  return Math.max(0, betaMaxClients() - (await clientBetaSlotsUsed()));
}

export async function trainerInPersonSlotsAvailable(): Promise<number> {
  if (!isBetaLaunchGatesEnabled()) return Number.POSITIVE_INFINITY;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.inPersonRemaining;
}

export async function isTrainerTotalBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.totalRemaining <= 0;
}
