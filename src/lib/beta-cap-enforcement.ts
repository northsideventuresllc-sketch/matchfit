import {
  betaExcludeCapCountEmails,
  betaMaxClients,
  betaMaxTrainers,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import {
  clientBetaSlotsUsed,
  countActiveClientBetaInvites,
  countActiveTrainerBetaInvites,
  trainerBetaSlotsUsed,
} from "@/lib/beta-waitlist-service";
import type { Prisma } from "@prisma/client";

export class BetaCapExceededError extends Error {
  readonly code: "BETA_TRAINER_CAP" | "BETA_CLIENT_CAP";

  constructor(message: string, code: "BETA_TRAINER_CAP" | "BETA_CLIENT_CAP") {
    super(message);
    this.name = "BetaCapExceededError";
    this.code = code;
  }
}

export async function countLaunchTrainersInTx(tx: Prisma.TransactionClient): Promise<number> {
  const ex = [...betaExcludeCapCountEmails()].map((e) => e.toLowerCase());
  return tx.trainer.count({
    where: {
      deidentifiedAt: null,
      ...(ex.length > 0 ? { NOT: { email: { in: ex } } } : {}),
    },
  });
}

async function countLaunchClientsInTx(tx: Prisma.TransactionClient): Promise<number> {
  const ex = [...betaExcludeCapCountEmails()].map((e) => e.toLowerCase());
  return tx.client.count({
    where: {
      deidentifiedAt: null,
      ...(ex.length > 0 ? { NOT: { email: { in: ex } } } : {}),
    },
  });
}

async function trainerSlotsUsedInTx(tx: Prisma.TransactionClient): Promise<number> {
  const [registered, invited] = await Promise.all([
    countLaunchTrainersInTx(tx),
    countActiveTrainerBetaInvites(tx),
  ]);
  return registered + invited;
}

async function clientSlotsUsedInTx(tx: Prisma.TransactionClient): Promise<number> {
  const [registered, invited] = await Promise.all([
    countLaunchClientsInTx(tx),
    countActiveClientBetaInvites(tx),
  ]);
  return registered + invited;
}

/** Re-check cap inside a transaction before creating a trainer (closes signup races). */
export async function assertTrainerBetaSlotInTransaction(
  tx: Prisma.TransactionClient,
  betaInviteEntryId: string | null,
): Promise<void> {
  if (!isBetaLaunchGatesEnabled()) return;
  const used = await trainerSlotsUsedInTx(tx);
  const max = betaMaxTrainers();
  if (used < max) return;
  if (betaInviteEntryId) {
    const invite = await tx.betaTrainerWaitlistEntry.findFirst({
      where: {
        id: betaInviteEntryId,
        status: "INVITED",
        slotExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (invite) return;
  }
  throw new BetaCapExceededError(
    "Coach slots are full for this beta. Join the waitlist and we will email you when a slot opens.",
    "BETA_TRAINER_CAP",
  );
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
  return Math.max(0, betaMaxTrainers() - (await trainerBetaSlotsUsed()));
}

export async function clientBetaSlotsAvailable(): Promise<number> {
  if (!isBetaLaunchGatesEnabled()) return Number.POSITIVE_INFINITY;
  return Math.max(0, betaMaxClients() - (await clientBetaSlotsUsed()));
}
