import {
  CLIENT_PAYMENT_GRACE_DAYS,
  CLIENT_PLATFORM_TRIAL_DAYS,
} from "@/lib/client-platform-trial-constants";

export type ClientPlatformBillingFields = {
  stripeSubscriptionId: string | null;
  stripeSubscriptionActive: boolean;
  subscriptionGraceUntil: Date | null;
  platformTrialEndsAt: Date | null;
  paymentGraceUntil: Date | null;
  accountDeactivatedAt: Date | null;
  platformTrialConsumed: boolean;
};

export type ClientPlatformAccessPhase =
  | "platform_trial"
  | "freemium"
  | "payment_grace"
  | "deactivated"
  | "paid"
  | "vip"
  | "stripe_lapsed_grace";

export type ClientPlatformAccessFields = ClientPlatformBillingFields & {
  vipSubscriptionActive?: boolean;
  clientPlanTier?: string;
};

export function resolveClientPlatformAccessPhase(
  client: ClientPlatformAccessFields,
  nowMs: number = Date.now(),
): ClientPlatformAccessPhase {
  if (client.accountDeactivatedAt) {
    return "deactivated";
  }

  if (client.vipSubscriptionActive) {
    return "vip";
  }

  if (client.stripeSubscriptionActive && client.stripeSubscriptionId?.trim()) {
    return "paid";
  }

  const trialEnds = client.platformTrialEndsAt?.getTime() ?? 0;
  const paymentGraceEnds = client.paymentGraceUntil?.getTime() ?? 0;

  if (trialEnds > nowMs) {
    return "platform_trial";
  }

  if (paymentGraceEnds > nowMs) {
    return "payment_grace";
  }

  if (client.platformTrialConsumed || trialEnds > 0) {
    return "freemium";
  }

  if (paymentGraceEnds > 0) {
    return "deactivated";
  }

  if (client.stripeSubscriptionId?.trim()) {
    if (client.subscriptionGraceUntil && client.subscriptionGraceUntil.getTime() > nowMs) {
      return "stripe_lapsed_grace";
    }
    return "deactivated";
  }

  return "platform_trial";
}

/** Blocks login entirely — used after payment grace expires without a subscription. */
export function isClientAccountLoginBlocked(client: ClientPlatformBillingFields, nowMs: number = Date.now()): boolean {
  return resolveClientPlatformAccessPhase(client, nowMs) === "deactivated";
}

/** When true, only billing-related dashboard routes are available until payment is connected. */
export function isClientBillingHardLocked(client: ClientPlatformAccessFields, nowMs: number = Date.now()): boolean {
  const phase = resolveClientPlatformAccessPhase(client, nowMs);
  if (phase === "freemium") return false;
  if (phase === "vip") return false;
  if (phase === "platform_trial") return false;
  if (phase === "payment_grace") return true;
  if (phase === "stripe_lapsed_grace") return true;
  if (phase === "deactivated") return true;
  return false;
}

export function clientNeedsPaymentSetup(client: ClientPlatformBillingFields, nowMs: number = Date.now()): boolean {
  const phase = resolveClientPlatformAccessPhase(client, nowMs);
  return phase === "payment_grace" || phase === "deactivated";
}

export function billingExemptDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith("/client/dashboard/billing") ||
    pathname.startsWith("/client/dashboard/notification-settings") ||
    pathname.startsWith("/client/dashboard/notifications") ||
    pathname.startsWith("/client/dashboard/fithub") ||
    pathname.startsWith("/client/dashboard/daily-questionnaire") ||
    pathname.startsWith("/client/dashboard/bug-report") ||
    pathname.startsWith("/client/dashboard/share-idea") ||
    pathname.startsWith("/client/dashboard/preferences/onboarding")
  );
}

export function describeClientPlatformTrialDays(): number {
  return CLIENT_PLATFORM_TRIAL_DAYS;
}

export function describeClientPaymentGraceDays(): number {
  return CLIENT_PAYMENT_GRACE_DAYS;
}
