import { prisma } from "@/lib/prisma";

export async function applyConversationAfterServicePurchase(args: {
  trainerId: string;
  clientId: string;
  conversationId?: string | null;
  sessionCreditsGranted: number;
  bookingUnlimitedPurchase: boolean;
}): Promise<void> {
  const conv = args.conversationId
    ? await prisma.trainerClientConversation.findFirst({
        where: { id: args.conversationId, trainerId: args.trainerId, clientId: args.clientId },
        select: {
          id: true,
          sessionCreditsPurchased: true,
          bookingUnlimitedAfterPurchase: true,
        },
      })
    : await prisma.trainerClientConversation.findUnique({
        where: { trainerId_clientId: { trainerId: args.trainerId, clientId: args.clientId } },
        select: {
          id: true,
          sessionCreditsPurchased: true,
          bookingUnlimitedAfterPurchase: true,
        },
      });
  if (!conv) return;

  const nextUnlimited = conv.bookingUnlimitedAfterPurchase || args.bookingUnlimitedPurchase;
  const creditDelta = args.bookingUnlimitedPurchase ? 0 : Math.max(0, args.sessionCreditsGranted);

  await prisma.trainerClientConversation.update({
    where: { id: conv.id },
    data: {
      bookingUnlimitedAfterPurchase: nextUnlimited,
      sessionCreditsPurchased: creditDelta > 0 ? { increment: creditDelta } : undefined,
      blockFreeSessionBookingUntilRepurchase: false,
      updatedAt: new Date(),
    },
  });
}

export async function clientHasPaidTrainerOnce(clientId: string, trainerId: string): Promise<boolean> {
  const n = await prisma.trainerClientServiceTransaction.count({ where: { clientId, trainerId } });
  return n > 0;
}

export async function getConversationBookingSnapshot(
  trainerId: string,
  clientId: string,
): Promise<{
  sessionCreditsPurchased: number;
  sessionCreditsUsed: number;
  bookingUnlimitedAfterPurchase: boolean;
  creditsRemaining: number;
}> {
  const conv = await prisma.trainerClientConversation.findUnique({
    where: { trainerId_clientId: { trainerId, clientId } },
    select: {
      sessionCreditsPurchased: true,
      sessionCreditsUsed: true,
      bookingUnlimitedAfterPurchase: true,
    },
  });
  if (!conv) {
    return {
      sessionCreditsPurchased: 0,
      sessionCreditsUsed: 0,
      bookingUnlimitedAfterPurchase: false,
      creditsRemaining: 0,
    };
  }
  const unlimited = conv.bookingUnlimitedAfterPurchase;
  const remaining = unlimited
    ? 999
    : Math.max(0, conv.sessionCreditsPurchased - conv.sessionCreditsUsed);
  return {
    sessionCreditsPurchased: conv.sessionCreditsPurchased,
    sessionCreditsUsed: conv.sessionCreditsUsed,
    bookingUnlimitedAfterPurchase: unlimited,
    creditsRemaining: remaining,
  };
}
