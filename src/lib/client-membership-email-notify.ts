import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";

function billingDashboardUrl(): string {
  return `${appBaseUrlForEmail()}/client/subscribe`;
}

export async function notifyClientMembershipTrialStarted(args: {
  clientId: string;
  email: string;
  trialDays: number;
  trialEndLabel: string;
  foundingSlot: boolean;
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
        monthlyUsd: "10.00",
        dashboardUrl: billingDashboardUrl(),
      },
    });
  } catch (e) {
    console.error("[membership email] trial started failed:", e);
  }
}

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
