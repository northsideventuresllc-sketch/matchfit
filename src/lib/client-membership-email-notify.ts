import { CLIENT_PAYMENT_GRACE_DAYS } from "@/lib/client-platform-trial-constants";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";

function billingDashboardUrl(): string {
  return `${appBaseUrlForEmail()}/client/dashboard/billing`;
}

export async function notifyClientMembershipTrialStarted(args: {
  clientId: string;
  email: string;
  trialDays: number;
  trialEndLabel: string;
  foundingSlot: boolean;
  /** When false, this is the card-free platform trial at sign-up. */
  cardOnFile: boolean;
}): Promise<void> {
  try {
    await sendTransactionalEmailIfAllowed({
      kind: "CLIENT_MEMBERSHIP_TRIAL_STARTED",
      to: args.email.trim(),
      audience: "CLIENT",
      clientId: args.clientId,
      variables: {
        trialDays: String(args.trialDays),
        trialEndLabel: args.trialEndLabel,
        foundingSlot: args.foundingSlot ? "1" : "0",
        cardOnFile: args.cardOnFile ? "1" : "0",
        paymentGraceDays: String(CLIENT_PAYMENT_GRACE_DAYS),
        monthlyUsd: "10.00",
        dashboardUrl: billingDashboardUrl(),
      },
    });
  } catch (e) {
    console.error("[membership email] trial started failed:", e);
  }
}

/** Stripe subscription trial ending (legacy checkout with card on file). */
export async function notifyClientMembershipTrialEnding(args: {
  stripeSubscriptionId: string;
  trialEndLabel: string;
}): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { stripeSubscriptionId: args.stripeSubscriptionId },
    select: { id: true, email: true },
  });
  if (!client?.email?.trim()) return;
  try {
    await sendTransactionalEmailIfAllowed({
      kind: "CLIENT_MEMBERSHIP_TRIAL_ENDING",
      to: client.email.trim(),
      audience: "CLIENT",
      clientId: client.id,
      variables: {
        trialEndLabel: args.trialEndLabel,
        monthlyUsd: "10.00",
        dashboardUrl: billingDashboardUrl(),
      },
    });
  } catch (e) {
    console.error("[membership email] trial ending failed:", e);
  }
}

/** Platform free trial ended — payment grace window to subscribe before deactivation. */
export async function notifyClientPlatformPaymentGraceStarted(args: {
  clientId: string;
  email: string;
  paymentGraceUntilLabel: string;
}): Promise<void> {
  try {
    await sendTransactionalEmailIfAllowed({
      kind: "CLIENT_PLATFORM_PAYMENT_GRACE_STARTED",
      to: args.email.trim(),
      audience: "CLIENT",
      clientId: args.clientId,
      variables: {
        paymentGraceDays: String(CLIENT_PAYMENT_GRACE_DAYS),
        paymentGraceUntilLabel: args.paymentGraceUntilLabel,
        monthlyUsd: "10.00",
        dashboardUrl: billingDashboardUrl(),
      },
    });
  } catch (e) {
    console.error("[membership email] payment grace started failed:", e);
  }
}

export async function notifyTrainerRegistrationFeeReceipt(args: {
  trainerId: string;
  email: string;
  amountLabel: string;
}): Promise<void> {
  try {
    await sendTransactionalEmailIfAllowed({
      kind: "TRAINER_REGISTRATION_FEE_RECEIPT",
      to: args.email.trim(),
      audience: "TRAINER",
      variables: {
        amount: args.amountLabel,
        trainerDashboardUrl: `${appBaseUrlForEmail()}/trainer/dashboard/compliance`,
      },
    });
  } catch (e) {
    console.error("[trainer registration email] receipt failed:", e);
  }
}
