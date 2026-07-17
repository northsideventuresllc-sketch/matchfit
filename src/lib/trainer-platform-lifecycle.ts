import { addTrainerPaymentGraceDays } from "@/lib/trainer-platform-trial-constants";
import { prisma } from "@/lib/prisma";

export type TrainerPlatformLifecycleSummary = {
  paymentGraceStarted: number;
  accountsDeactivated: number;
};

const platformBillingSelect = {
  id: true,
  email: true,
  stripeSubscriptionId: true,
  stripeSubscriptionActive: true,
  platformTrialEndsAt: true,
  paymentGraceUntil: true,
  accountDeactivatedAt: true,
  platformTrialConsumed: true,
} as const;

async function startPaymentGraceForTrainer(
  trainer: {
    id: string;
    email: string;
    platformTrialEndsAt: Date | null;
  },
  now: Date,
): Promise<void> {
  const paymentGraceUntil = addTrainerPaymentGraceDays(trainer.platformTrialEndsAt ?? now);
  await prisma.trainer.update({
    where: { id: trainer.id },
    data: {
      paymentGraceUntil,
      platformTrialConsumed: true,
    },
  });
}

/** Advance trial → payment grace → deactivation for trainers without an active Stripe subscription. */
export async function runTrainerPlatformBillingLifecycleJobs(): Promise<TrainerPlatformLifecycleSummary> {
  const now = new Date();
  let paymentGraceStarted = 0;
  let accountsDeactivated = 0;

  const trialExpired = await prisma.trainer.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      platformTrialEndsAt: { lte: now },
      paymentGraceUntil: null,
      stripeSubscriptionActive: false,
      OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: "" }],
    },
    select: platformBillingSelect,
  });

  for (const trainer of trialExpired) {
    await startPaymentGraceForTrainer(trainer, now);
    paymentGraceStarted += 1;
  }

  const graceExpired = await prisma.trainer.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      paymentGraceUntil: { lte: now },
      stripeSubscriptionActive: false,
    },
    select: platformBillingSelect,
  });

  for (const trainer of graceExpired) {
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
      },
    });
    accountsDeactivated += 1;
  }

  return { paymentGraceStarted, accountsDeactivated };
}

/** Lazy lifecycle sync for a single trainer on login or dashboard access. */
export async function syncTrainerPlatformBillingLifecycle(trainerId: string): Promise<void> {
  const now = new Date();
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: platformBillingSelect,
  });
  if (!trainer || trainer.accountDeactivatedAt) return;
  if (trainer.stripeSubscriptionActive && trainer.stripeSubscriptionId?.trim()) return;

  if (
    trainer.platformTrialEndsAt &&
    trainer.platformTrialEndsAt.getTime() <= now.getTime() &&
    !trainer.paymentGraceUntil
  ) {
    await startPaymentGraceForTrainer(trainer, now);
    return;
  }

  if (trainer.paymentGraceUntil && trainer.paymentGraceUntil.getTime() <= now.getTime()) {
    await prisma.trainer.update({
      where: { id: trainer.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
      },
    });
  }
}
