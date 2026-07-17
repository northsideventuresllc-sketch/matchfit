import {
  TRAINER_PAYMENT_GRACE_DAYS,
  TRAINER_PLATFORM_TRIAL_DAYS,
} from "@/lib/trainer-platform-trial-constants";

export type TrainerPlatformBillingFields = {
  stripeSubscriptionId: string | null;
  stripeSubscriptionActive: boolean;
  subscriptionGraceUntil: Date | null;
  platformTrialEndsAt: Date | null;
  paymentGraceUntil: Date | null;
  accountDeactivatedAt: Date | null;
  platformTrialConsumed: boolean;
};

export type TrainerPlatformAccessPhase =
  | "platform_trial"
  | "payment_grace"
  | "deactivated"
  | "paid"
  | "stripe_lapsed_grace";

export function resolveTrainerPlatformAccessPhase(
  trainer: TrainerPlatformBillingFields,
  nowMs: number = Date.now(),
): TrainerPlatformAccessPhase {
  if (trainer.accountDeactivatedAt) {
    return "deactivated";
  }

  if (trainer.stripeSubscriptionActive && trainer.stripeSubscriptionId?.trim()) {
    return "paid";
  }

  const trialEnds = trainer.platformTrialEndsAt?.getTime() ?? 0;
  const paymentGraceEnds = trainer.paymentGraceUntil?.getTime() ?? 0;

  if (trialEnds > nowMs) {
    return "platform_trial";
  }

  if (paymentGraceEnds > nowMs) {
    return "payment_grace";
  }

  if (trainer.platformTrialConsumed || trialEnds > 0 || paymentGraceEnds > 0) {
    return "deactivated";
  }

  if (trainer.stripeSubscriptionId?.trim()) {
    if (trainer.subscriptionGraceUntil && trainer.subscriptionGraceUntil.getTime() > nowMs) {
      return "stripe_lapsed_grace";
    }
    return "deactivated";
  }

  return "platform_trial";
}

/** Blocks login entirely — used after payment grace expires without a subscription. */
export function isTrainerAccountLoginBlocked(
  trainer: TrainerPlatformBillingFields,
  nowMs: number = Date.now(),
): boolean {
  return resolveTrainerPlatformAccessPhase(trainer, nowMs) === "deactivated";
}

/** When true, only billing-related dashboard routes are available until payment is connected. */
export function isTrainerBillingHardLocked(
  trainer: TrainerPlatformBillingFields,
  nowMs: number = Date.now(),
): boolean {
  const phase = resolveTrainerPlatformAccessPhase(trainer, nowMs);
  if (phase === "payment_grace") return true;
  if (phase === "stripe_lapsed_grace") return true;
  if (phase === "deactivated") return true;
  return false;
}

export function trainerNeedsPaymentSetup(
  trainer: TrainerPlatformBillingFields,
  nowMs: number = Date.now(),
): boolean {
  const phase = resolveTrainerPlatformAccessPhase(trainer, nowMs);
  return phase === "payment_grace" || phase === "deactivated";
}

export function trainerBillingExemptDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith("/trainer/dashboard/billing") ||
    pathname.startsWith("/trainer/dashboard/notification-settings") ||
    pathname.startsWith("/trainer/dashboard/notifications") ||
    pathname.startsWith("/trainer/dashboard/bug-report") ||
    pathname.startsWith("/trainer/dashboard/share-idea")
  );
}

export function describeTrainerPlatformTrialDays(): number {
  return TRAINER_PLATFORM_TRIAL_DAYS;
}

export function describeTrainerPaymentGraceDays(): number {
  return TRAINER_PAYMENT_GRACE_DAYS;
}
