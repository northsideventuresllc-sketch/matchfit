import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";

function billingDashboardUrl(): string {
  return `${appBaseUrlForEmail()}/client/subscribe`;
}

/**
 * Notifies the client by email when Stripe reports a subscription lifecycle change.
 */
export async function notifyClientSubscriptionStripeEvent(params: {
  stripeSubscriptionId: string;
  stripeEventType: string;
}): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { stripeSubscriptionId: params.stripeSubscriptionId },
    select: { id: true, email: true },
  });
  if (!client?.email?.trim()) return;

  const detail =
    params.stripeEventType === "customer.subscription.deleted"
      ? "Your subscription ended or was canceled in billing."
      : `Stripe event: ${params.stripeEventType.replace(/^customer\.subscription\./, "")}.`;

  try {
    await sendTransactionalEmailIfAllowed({
      kind: "SUBSCRIPTION_MANAGEMENT_UPDATE",
      to: client.email.trim(),
      audience: "CLIENT",
      clientId: client.id,
      variables: {
        statusLine: "Your Match Fit membership billing was updated.",
        detailLine: detail,
        dashboardUrl: billingDashboardUrl(),
      },
    });
  } catch (e) {
    console.error("[subscription email] failed:", e);
  }
}
