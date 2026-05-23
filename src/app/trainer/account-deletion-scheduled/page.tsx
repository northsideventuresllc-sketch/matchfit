import { redirect } from "next/navigation";
import { AccountDeletionScheduledPanel } from "@/components/account-deletion-scheduled-panel";
import {
  finalizeScheduledDeletionIfOverdue,
  isAccountDeletionGraceActive,
} from "@/lib/account-deletion-grace";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export default async function TrainerAccountDeletionScheduledPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      deidentifiedAt: true,
      accountDeletionFinalizeAt: true,
    },
  });
  if (!trainer || trainer.deidentifiedAt) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  if (await finalizeScheduledDeletionIfOverdue({ role: "trainer", id: trainerId })) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  if (!isAccountDeletionGraceActive(trainer) || !trainer.accountDeletionFinalizeAt) {
    redirect("/trainer/dashboard");
  }

  return (
    <AccountDeletionScheduledPanel
      role="trainer"
      finalizeAtIso={trainer.accountDeletionFinalizeAt.toISOString()}
    />
  );
}
