import {
  accountDeletionScheduledLoginNext,
  finalizeScheduledDeletionIfOverdue,
  isAccountDeletionGraceActive,
} from "@/lib/account-deletion-grace";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column";

const DELETION_COL = "accountDeletionFinalizeAt";

export async function clientLoginDeletionRedirect(
  clientId: string,
): Promise<{ next: string; finalizeAt: string } | null> {
  try {
    if (await finalizeScheduledDeletionIfOverdue({ role: "client", id: clientId })) {
      return null;
    }
    const row = await prisma.client.findUnique({
      where: { id: clientId },
      select: { accountDeletionRequestedAt: true, accountDeletionFinalizeAt: true, deidentifiedAt: true },
    });
    if (!row || row.deidentifiedAt || !isAccountDeletionGraceActive(row)) return null;
    return {
      next: accountDeletionScheduledLoginNext("client"),
      finalizeAt: row.accountDeletionFinalizeAt!.toISOString(),
    };
  } catch (e) {
    if (isPrismaMissingColumnError(e, DELETION_COL)) return null;
    throw e;
  }
}

export async function trainerLoginDeletionRedirect(
  trainerId: string,
): Promise<{ next: string; finalizeAt: string } | null> {
  try {
    if (await finalizeScheduledDeletionIfOverdue({ role: "trainer", id: trainerId })) {
      return null;
    }
    const row = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { accountDeletionRequestedAt: true, accountDeletionFinalizeAt: true, deidentifiedAt: true },
    });
    if (!row || row.deidentifiedAt || !isAccountDeletionGraceActive(row)) return null;
    return {
      next: accountDeletionScheduledLoginNext("trainer"),
      finalizeAt: row.accountDeletionFinalizeAt!.toISOString(),
    };
  } catch (e) {
    if (isPrismaMissingColumnError(e, DELETION_COL)) return null;
    throw e;
  }
}
