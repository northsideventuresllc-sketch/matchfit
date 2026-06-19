import { prisma } from "@/lib/prisma";
import { banTrainerDeferredFee } from "@/lib/trainer-deferred-fee";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

const MS_PER_HOUR = 60 * 60 * 1000;

export type TrainerDeferredFeeLifecycleSummary = {
  graceStarted: number;
  banned: number;
};

export async function runTrainerDeferredFeeLifecycleJobs(): Promise<TrainerDeferredFeeLifecycleSummary> {
  const now = new Date();
  let graceStarted = 0;
  let banned = 0;

  const needsGrace = await prisma.trainer.findMany({
    where: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: { gt: 0 },
      registrationFeeDeferredDeadlineAt: { lte: now },
      registrationFeeGraceDeadlineAt: null,
      registrationFeeDeferredBannedAt: null,
      deidentifiedAt: null,
    },
    select: { id: true, email: true },
  });

  for (const trainer of needsGrace) {
    const graceDeadline = new Date(now.getTime() + 72 * MS_PER_HOUR);
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: { registrationFeeGraceDeadlineAt: graceDeadline },
    });
    graceStarted += 1;

    if (trainer.email?.trim()) {
      void sendTransactionalEmailIfAllowed({
        kind: "TRAINER_DEFERRED_FEE_GRACE_STARTED",
        to: trainer.email.trim(),
        audience: "TRAINER",
        trainerId: trainer.id,
        variables: {
          graceDeadlineLabel: graceDeadline.toLocaleDateString("en-US", { dateStyle: "long" }),
          trainerDashboardUrl:
            process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") + "/trainer/dashboard/billing" ||
            "https://match-fit.net/trainer/dashboard/billing",
        },
      }).catch((e) => console.error("[trainer-deferred-fee-lifecycle] grace email failed:", e));
    }
  }

  const needsBan = await prisma.trainer.findMany({
    where: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: { gt: 0 },
      registrationFeeGraceDeadlineAt: { lte: now },
      registrationFeeDeferredBannedAt: null,
      deidentifiedAt: null,
    },
    select: { id: true, email: true },
  });

  for (const trainer of needsBan) {
    await banTrainerDeferredFee(trainer.id);
    banned += 1;

    if (trainer.email?.trim()) {
      void sendTransactionalEmailIfAllowed({
        kind: "TRAINER_DEFERRED_FEE_BANNED",
        to: trainer.email.trim(),
        audience: "TRAINER",
        trainerId: trainer.id,
        variables: {
          trainerDashboardUrl:
            process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") + "/trainer/dashboard" ||
            "https://match-fit.net/trainer/dashboard",
        },
      }).catch((e) => console.error("[trainer-deferred-fee-lifecycle] ban email failed:", e));
    }
  }

  return { graceStarted, banned };
}
