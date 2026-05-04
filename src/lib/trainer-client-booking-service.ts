import { prisma } from "@/lib/prisma";
import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import {
  clientHasPaidTrainerOnce,
  getConversationBookingSnapshot,
} from "@/lib/trainer-client-booking-credits";

function deadlineBeforeSession(startsAt: Date): Date {
  const d = new Date(startsAt);
  d.setHours(d.getHours() - 1);
  const floor = new Date(Date.now() + 60 * 60 * 1000);
  return d.getTime() < floor.getTime() ? floor : d;
}

export async function createTrainerBookingInvite(args: {
  trainerId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  note?: string | null;
  /** IN_PERSON | VIRTUAL */
  sessionDelivery?: "IN_PERSON" | "VIRTUAL";
}): Promise<{ ok: true; bookingId: string } | { error: string }> {
  const paid = await clientHasPaidTrainerOnce(args.clientId, args.trainerId);
  if (!paid) {
    return { error: "The client must complete at least one paid checkout before you can send booking invites." };
  }
  if (args.startsAt.getTime() <= Date.now()) {
    return { error: "Start time must be in the future." };
  }
  if (args.endsAt.getTime() <= args.startsAt.getTime()) {
    return { error: "End time must be after start time." };
  }
  if (args.endsAt.getTime() - args.startsAt.getTime() > 12 * 60 * 60 * 1000) {
    return { error: "Booking window cannot exceed 12 hours." };
  }

  const conv = await prisma.trainerClientConversation.findUnique({
    where: { trainerId_clientId: { trainerId: args.trainerId, clientId: args.clientId } },
    select: {
      id: true,
      archivedAt: true,
      officialChatStartedAt: true,
    },
  });
  if (!conv?.officialChatStartedAt || conv.archivedAt) {
    return { error: "This chat is not available for booking." };
  }

  const snap = await getConversationBookingSnapshot(args.trainerId, args.clientId);
  if (!snap.bookingUnlimitedAfterPurchase) {
    const pendingInvites = await prisma.bookedTrainingSession.count({
      where: { trainerId: args.trainerId, clientId: args.clientId, status: "INVITED" },
    });
    const remaining = snap.creditsRemaining - pendingInvites;
    if (remaining <= 0) {
      return {
        error:
          "This client has no remaining session credits for new bookings. They need to purchase another eligible package (not DIY / unlimited-monthly style).",
      };
    }
  }

  const sessionDelivery = args.sessionDelivery === "VIRTUAL" ? "VIRTUAL" : "IN_PERSON";

  const booking = await prisma.bookedTrainingSession.create({
    data: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      conversationId: conv.id,
      scheduledStartAt: args.startsAt,
      scheduledEndAt: args.endsAt,
      confirmationDeadlineAt: deadlineBeforeSession(args.startsAt),
      status: "INVITED",
      trainerAmountCents: 0,
      inviteNote: args.note?.trim() || null,
      sessionDelivery,
    },
    select: { id: true },
  });

  const startLabel = args.startsAt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = args.endsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const deliveryPhrase = sessionDelivery === "VIRTUAL" ? "Virtual meeting" : "In person";
  const msgBody = [
    `Match Fit booking invite (${deliveryPhrase}): ${startLabel} – ${endLabel}.`,
    args.note?.trim() ? `Note from your coach: ${args.note.trim()}` : null,
    `Booking id: ${booking.id}`,
    `Reply in this thread if you need a change. To confirm, open your chat booking actions (Confirm) for id ${booking.id}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await runOutboundChatComplianceMonitoring({
    conversationId: conv.id,
    authorRole: "TRAINER",
    body: msgBody,
  });

  await prisma.trainerClientChatMessage.create({
    data: { conversationId: conv.id, authorRole: "TRAINER", body: msgBody },
  });
  await prisma.trainerClientConversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() },
  });

  return { ok: true, bookingId: booking.id };
}

export async function clientConfirmBooking(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "INVITED" },
    select: {
      id: true,
      trainerId: true,
      conversationId: true,
    },
  });
  if (!row) {
    return { error: "Booking not found or already handled." };
  }

  await prisma.$transaction(async (tx) => {
    const conv = row.conversationId
      ? await tx.trainerClientConversation.findUnique({
          where: { id: row.conversationId },
          select: { id: true, bookingUnlimitedAfterPurchase: true },
        })
      : null;

    await tx.bookedTrainingSession.update({
      where: { id: row.id },
      data: { status: "CLIENT_CONFIRMED", updatedAt: new Date() },
    });

    if (conv && !conv.bookingUnlimitedAfterPurchase) {
      await tx.trainerClientConversation.update({
        where: { id: conv.id },
        data: { sessionCreditsUsed: { increment: 1 }, updatedAt: new Date() },
      });
    }
  });

  return { ok: true };
}

export async function clientDeclineBooking(args: {
  bookingId: string;
  clientId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, clientId: args.clientId, status: "INVITED" },
    select: { id: true },
  });
  if (!row) return { error: "Booking not found or already handled." };
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: { status: "CANCELLED", updatedAt: new Date() },
  });
  return { ok: true };
}
