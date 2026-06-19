import {
  banTrainerDeferredFee,
  DEFERRED_FEE_GRACE_HOURS,
} from "@/lib/trainer-deferred-fee";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { prisma } from "@/lib/prisma";

export type TrainerDeferredFeeLifecycleSummary = {
  graceStarted: number;
  banned: number;
};

const MS_PER_HOUR = 60 * 60 * 1000;

export async function runTrainerDeferredFeeLifecycleJobs(): Promise<TrainerDeferredFeeLifecycleSummary> {
  const now = new Date();
  let graceStarted = 0;
  let banned = 0;

  const enteringGrace = await prisma.trainer.findMany({
    where: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: { gt: 0 },
      registrationFeeDeferredDeadlineAt: { lte: now },
      registrationFeeGraceDeadlineAt: null,
      registrationFeeDeferredBannedAt: null,
      accountDeactivatedAt: null,
    },
    select: { id: true, email: true },
  });

  for (const trainer of enteringGrace) {
    const graceDeadline = new Date(now.getTime() + DEFERRED_FEE_GRACE_HOURS * MS_PER_HOUR);
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: { registrationFeeGraceDeadlineAt: graceDeadline },
    });
    graceStarted += 1;

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://match-fit.net";
    void sendTransactionalEmailIfAllowed({
      kind: "TRAINER_DEFERRED_FEE_GRACE_STARTED",
      to: trainer.email,
      audience: "TRAINER",
      trainerId: trainer.id,
      variables: {
        graceHours: String(DEFERRED_FEE_GRACE_HOURS),
        trainerDashboardUrl: `${origin}/trainer/dashboard/billing`,
      },
    }).catch((e) => console.error("[deferred fee cron] grace email failed:", e));
  }

  const graceExpired = await prisma.trainer.findMany({
    where: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: { gt: 0 },
      registrationFeeGraceDeadlineAt: { lte: now },
      registrationFeeDeferredBannedAt: null,
    },
    select: { id: true, email: true },
  });

  for (const trainer of graceExpired) {
    await banTrainerDeferredFee(trainer.id);
    banned += 1;

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://match-fit.net";
    void sendTransactionalEmailIfAllowed({
      kind: "TRAINER_DEFERRED_FEE_BANNED",
      to: trainer.email,
      audience: "TRAINER",
      trainerId: trainer.id,
      variables: {
        supportEmail: process.env.MATCH_FIT_SUPPORT_EMAIL?.trim() || "support@match-fit.net",
        trainerDashboardUrl: `${origin}/trainer/dashboard`,
      },
    }).catch((e) => console.error("[deferred fee cron] ban email failed:", e));
  }

  return { graceStarted, banned };
}
