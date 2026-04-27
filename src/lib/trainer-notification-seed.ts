import { prisma } from "@/lib/prisma";

/** Starter rows so the trainer notifications menu demonstrates coach-relevant categories. */
export async function ensureStarterTrainerNotifications(trainerId: string): Promise<void> {
  const count = await prisma.trainerNotification.count({ where: { trainerId } });
  if (count > 0) return;

  await prisma.trainerNotification.createMany({
    data: [
      {
        trainerId,
        kind: "INQUIRY",
        title: "CLIENT INQUIRIES",
        body: "When clients request you from discovery, their inquiries will appear here and in Inquiries.",
        linkHref: "/trainer/dashboard/interests",
        readAt: null,
      },
      {
        trainerId,
        kind: "CHAT",
        title: "CHAT ACTIVITY",
        body: "New messages from clients you are connected with will show here and in Chats.",
        linkHref: "/trainer/dashboard/messages",
        readAt: null,
      },
      {
        trainerId,
        kind: "CERTIFICATION",
        title: "CREDENTIAL REVIEWS",
        body: "Uploads and review outcomes for CPT or nutrition credentials appear here and under Compliance.",
        linkHref: "/trainer/dashboard/compliance",
        readAt: null,
      },
      {
        trainerId,
        kind: "COMPLIANCE",
        title: "COMPLIANCE REMINDERS",
        body: "Background check, W-9, and agreement tasks will surface here until your profile is fully cleared.",
        linkHref: "/trainer/dashboard/compliance",
        readAt: null,
      },
      {
        trainerId,
        kind: "BILLING",
        title: "BILLING & PAYOUTS",
        body: "Subscription, Premium Page fees, and payout notices will appear here as billing tools roll out.",
        linkHref: "/trainer/dashboard/billing",
        readAt: null,
      },
      {
        trainerId,
        kind: "PLATFORM",
        title: "WELCOME, COACH",
        body: "Match Fit will post product updates, policy changes, and safety notices that affect your practice.",
        linkHref: "/trainer/dashboard",
        readAt: null,
      },
    ],
  });
}
