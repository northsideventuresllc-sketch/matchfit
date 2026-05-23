import {
  deidentifyClientAccount,
  deidentifyTrainerAccount,
} from "@/lib/account-deletion";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion-grace-constants";
import { prisma } from "@/lib/prisma";

export { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion-grace-constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function accountDeletionGraceMs(): number {
  return ACCOUNT_DELETION_GRACE_DAYS * MS_PER_DAY;
}

export function computeAccountDeletionFinalizeAt(requestedAt: Date = new Date()): Date {
  return new Date(requestedAt.getTime() + accountDeletionGraceMs());
}

type DeletionScheduleFields = {
  accountDeletionRequestedAt: Date | null;
  accountDeletionFinalizeAt: Date | null;
};

export function isAccountDeidentified(deidentifiedAt: Date | null | undefined): boolean {
  return deidentifiedAt != null;
}

/** User asked to delete and the grace window has not ended (or cron has not run yet). */
export function isAccountPendingDeletion(row: DeletionScheduleFields): boolean {
  if (isAccountDeidentified((row as { deidentifiedAt?: Date | null }).deidentifiedAt)) return false;
  const at = row.accountDeletionFinalizeAt;
  return at != null;
}

/** Still in grace — user may log in and cancel deletion. */
export function isAccountDeletionGraceActive(row: DeletionScheduleFields): boolean {
  const at = row.accountDeletionFinalizeAt;
  if (!at) return false;
  return at.getTime() > Date.now();
}

/** Past finalize time but row not yet scrubbed (cron pending). */
export function isAccountDeletionOverdue(row: DeletionScheduleFields): boolean {
  const at = row.accountDeletionFinalizeAt;
  if (!at) return false;
  return at.getTime() <= Date.now();
}

/** Prisma filter: account is live on the marketplace (not deleted, not in deletion grace). */
export const marketplaceActiveClientWhere = {
  deidentifiedAt: null,
  accountDeletionFinalizeAt: null,
} as const;

export const marketplaceActiveTrainerWhere = {
  deidentifiedAt: null,
  accountDeletionFinalizeAt: null,
} as const;

export async function scheduleClientAccountDeletion(clientId: string): Promise<Date> {
  const requestedAt = new Date();
  const finalizeAt = computeAccountDeletionFinalizeAt(requestedAt);
  await prisma.client.update({
    where: { id: clientId },
    data: {
      accountDeletionRequestedAt: requestedAt,
      accountDeletionFinalizeAt: finalizeAt,
      allowTrainerDiscovery: false,
    },
  });
  return finalizeAt;
}

export async function scheduleTrainerAccountDeletion(trainerId: string): Promise<Date> {
  const requestedAt = new Date();
  const finalizeAt = computeAccountDeletionFinalizeAt(requestedAt);
  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      accountDeletionRequestedAt: requestedAt,
      accountDeletionFinalizeAt: finalizeAt,
    },
  });
  return finalizeAt;
}

export async function cancelScheduledClientAccountDeletion(clientId: string): Promise<boolean> {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      deidentifiedAt: true,
      accountDeletionFinalizeAt: true,
    },
  });
  if (!row || row.deidentifiedAt || !isAccountDeletionGraceActive(row)) {
    return false;
  }
  await prisma.client.update({
    where: { id: clientId },
    data: {
      accountDeletionRequestedAt: null,
      accountDeletionFinalizeAt: null,
    },
  });
  return true;
}

/** If grace ended but cron has not run, finalize now so login and discovery stay consistent. */
export async function finalizeScheduledDeletionIfOverdue(args: {
  role: "client" | "trainer";
  id: string;
}): Promise<boolean> {
  if (args.role === "client") {
    const row = await prisma.client.findUnique({
      where: { id: args.id },
      select: { deidentifiedAt: true, accountDeletionFinalizeAt: true },
    });
    if (!row || row.deidentifiedAt || !isAccountDeletionOverdue(row)) return false;
    await deidentifyClientAccount(args.id);
    return true;
  }
  const row = await prisma.trainer.findUnique({
    where: { id: args.id },
    select: { deidentifiedAt: true, accountDeletionFinalizeAt: true },
  });
  if (!row || row.deidentifiedAt || !isAccountDeletionOverdue(row)) return false;
  await deidentifyTrainerAccount(args.id);
  return true;
}

export async function cancelScheduledTrainerAccountDeletion(trainerId: string): Promise<boolean> {
  const row = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      deidentifiedAt: true,
      accountDeletionFinalizeAt: true,
    },
  });
  if (!row || row.deidentifiedAt || !isAccountDeletionGraceActive(row)) {
    return false;
  }
  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      accountDeletionRequestedAt: null,
      accountDeletionFinalizeAt: null,
    },
  });
  return true;
}

export type FinalizeDueDeletionsSummary = {
  clientsFinalized: number;
  trainersFinalized: number;
};

/** Permanently de-identify accounts whose grace period ended. */
export async function finalizeDueAccountDeletions(
  now: Date = new Date(),
): Promise<FinalizeDueDeletionsSummary> {
  const dueClients = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeletionFinalizeAt: { lte: now },
    },
    select: { id: true },
  });
  const dueTrainers = await prisma.trainer.findMany({
    where: {
      deidentifiedAt: null,
      accountDeletionFinalizeAt: { lte: now },
    },
    select: { id: true },
  });

  for (const { id } of dueClients) {
    await deidentifyClientAccount(id);
  }
  for (const { id } of dueTrainers) {
    await deidentifyTrainerAccount(id);
  }

  return {
    clientsFinalized: dueClients.length,
    trainersFinalized: dueTrainers.length,
  };
}

export function accountDeletionScheduledLoginNext(role: "client" | "trainer"): string {
  return role === "client" ? "/client/account-deletion-scheduled" : "/trainer/account-deletion-scheduled";
}
