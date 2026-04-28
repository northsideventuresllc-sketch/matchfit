import { prisma } from "@/lib/prisma";

/** One-time starter rows so the notifications menu demonstrates all categories. */
export async function ensureStarterClientNotifications(clientId: string): Promise<void> {
  const count = await prisma.clientNotification.count({ where: { clientId } });
  if (count > 0) return;

  await prisma.clientNotification.createMany({
    data: [
      {
        clientId,
        kind: "DAILY_QUESTIONNAIRE",
        title: "DAILY CHECK-IN",
        body: "A new daily questionnaire will appear here when the program launches.",
        linkHref: "/client/dashboard/preferences",
        readAt: null,
      },
      {
        clientId,
        kind: "APP_UPDATE",
        title: "APP UPDATE",
        body: "You are on the latest Match Fit client experience. We will notify you when a new build ships.",
        linkHref: null,
        readAt: null,
      },
      {
        clientId,
        kind: "BILLING",
        title: "BILLING REMINDER",
        body: "Keep your subscription current from Billing settings so you never lose access after any grace period.",
        linkHref: "/client/dashboard/billing",
        readAt: null,
      },
      {
        clientId,
        kind: "SYSTEM",
        title: "WELCOME TO MATCH FIT",
        body: "Coaches you save and trainers who nudge you will appear in Notifications and Chats.",
        linkHref: "/client/dashboard/messages",
        readAt: null,
      },
    ],
  });
}
