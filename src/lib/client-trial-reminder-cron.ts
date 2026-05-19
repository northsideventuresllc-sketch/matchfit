import { prisma } from "@/lib/prisma";
import { sendClientTrialEndingEmail } from "@/lib/client-trial-email";
import { formatClientPlatformSubscriptionUsd } from "@/lib/client-platform-subscription-pricing";
import { LAUNCH_CLIENT_TRIAL_DAYS } from "@/lib/match-fit-launch-cohort";

const MS_HOUR = 60 * 60 * 1000;

export type ClientTrialReminderCronSummary = {
  emails48h: number;
  emails24h: number;
  inApp24h: number;
};

export async function runClientTrialReminderCron(): Promise<ClientTrialReminderCronSummary> {
  const now = Date.now();
  let emails48h = 0;
  let emails24h = 0;
  let inApp24h = 0;

  const clients = await prisma.client.findMany({
    where: {
      stripeSubscriptionActive: true,
      subscriptionTrialEndsAt: { gt: new Date() },
      deidentifiedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      preferredName: true,
      clientTrialPlan: true,
      subscriptionTrialEndsAt: true,
      trialEnding48hEmailSentAt: true,
      trialEnding24hEmailSentAt: true,
    },
  });

  const monthlyLabel = formatClientPlatformSubscriptionUsd();

  for (const c of clients) {
    const ends = c.subscriptionTrialEndsAt!.getTime();
    const hoursLeft = (ends - now) / MS_HOUR;
    const isLaunch = c.clientTrialPlan === "LAUNCH_7D";

    if (isLaunch && hoursLeft <= 48 && hoursLeft > 24 && !c.trialEnding48hEmailSentAt) {
      const sent = await sendClientTrialEndingEmail({
        email: c.email,
        firstName: c.preferredName || c.firstName,
        hoursUntilBill: Math.round(hoursLeft),
        monthlyLabel,
        windowLabel: `${LAUNCH_CLIENT_TRIAL_DAYS}-day launch trial`,
      });
      if (sent) {
        await prisma.client.update({
          where: { id: c.id },
          data: { trialEnding48hEmailSentAt: new Date() },
        });
        emails48h += 1;
      }
    }

    if (hoursLeft <= 24 && hoursLeft > 0 && !c.trialEnding24hEmailSentAt) {
      const sent = await sendClientTrialEndingEmail({
        email: c.email,
        firstName: c.preferredName || c.firstName,
        hoursUntilBill: Math.max(1, Math.round(hoursLeft)),
        monthlyLabel,
        windowLabel: isLaunch ? `${LAUNCH_CLIENT_TRIAL_DAYS}-day launch trial` : "72-hour free access",
      });
      if (sent) {
        await prisma.client.update({
          where: { id: c.id },
          data: { trialEnding24hEmailSentAt: new Date() },
        });
        emails24h += 1;
      }

      await prisma.clientNotification.create({
        data: {
          clientId: c.id,
          kind: "BILLING",
          title: "Your free access ends soon",
          body: `Your Match Fit trial ends in about ${Math.max(1, Math.round(hoursLeft))} hour(s). Your card on file will be charged ${monthlyLabel} unless you cancel or choose Pay now in Billing.`,
          linkHref: "/client/dashboard/billing",
        },
      });
      inApp24h += 1;
    }
  }

  return { emails48h, emails24h, inApp24h };
}
