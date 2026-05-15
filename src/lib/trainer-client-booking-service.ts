import { prisma } from "@/lib/prisma";
import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import {
  clientHasPaidTrainerOnce,
  getConversationBookingSnapshot,
} from "@/lib/trainer-client-booking-credits";
import { allocationNetCentsForSession, sessionConsumedBillingUnits } from "@/lib/financial-ledger-split";
import type { BillingUnit } from "@/lib/trainer-match-questionnaire";
import { computeAverageCoachServiceCentsPerCredit } from "@/lib/session-check-in";
import { checkInWindowStartAt } from "@/lib/session-check-in-timing";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

function videoConferenceProviderClientLabel(stored: string | null | undefined): string {
  if (!stored) return "";
  if (stored === "GOOGLE_MEET") return "Google Meet";
  if (stored === "ZOOM") return "Zoom";
  if (stored === "MICROSOFT_TEAMS") return "Microsoft Teams";
  if (stored === "MANUAL") return "Video link";
  return stored.replace(/_/g, " ");
}

export function deadlineBeforeSession(startsAt: Date): Date {
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
      blockFreeSessionBookingUntilRepurchase: true,
    },
  });
  if (!conv?.officialChatStartedAt || conv.archivedAt) {
    return { error: "This chat is not available for booking." };
  }

  const snap = await getConversationBookingSnapshot(args.trainerId, args.clientId);
  if (conv.blockFreeSessionBookingUntilRepurchase && !snap.bookingUnlimitedAfterPurchase) {
    return {
      error:
        "This client must complete a new paid package in this thread before more sessions can be booked (coach declined a prior reschedule per Match Fit policy).",
    };
  }
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
    `Reply in this thread if you need a change. Confirmation unlocks 24 hours before the scheduled start (Chat or Service Management) for id ${booking.id}.`,
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
      clientId: true,
      conversationId: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });
  if (!row) {
    return { error: "Booking not found or already handled." };
  }

  const inviteWindowStart = checkInWindowStartAt(row.scheduledStartAt).getTime();
  const now = Date.now();
  if (now < inviteWindowStart) {
    return { error: "Session confirmation opens 24 hours before the scheduled start." };
  }
  if (now >= row.scheduledStartAt.getTime()) {
    return { error: "This invite’s scheduled start has already passed." };
  }

  const avgCoachPerCreditFallback = await computeAverageCoachServiceCentsPerCredit({
    trainerId: row.trainerId,
    clientId: row.clientId,
  });

  const txRow = await prisma.trainerClientServiceTransaction.findFirst({
    where: { trainerId: row.trainerId, clientId: row.clientId },
    orderBy: { completedAt: "desc" },
    select: {
      stripePaymentIntentId: true,
      ledgerPerServiceUnitNetCents: true,
      ledgerPerAddonUnitNetCents: true,
      ledgerNetAddonPoolCents: true,
      amountCents: true,
      sessionCreditsGranted: true,
      billingUnit: true,
    },
  });

  const billingU = ((txRow?.billingUnit ?? "multi_session") as BillingUnit) ?? "multi_session";
  const consumed = sessionConsumedBillingUnits(row.scheduledStartAt, row.scheduledEndAt, billingU);
  const addonUnitsAttributed = (txRow?.ledgerNetAddonPoolCents ?? 0) > 0 ? 1 : 0;
  const { netService, netAddon } = allocationNetCentsForSession({
    ledgerPerServiceUnitNetCents: txRow?.ledgerPerServiceUnitNetCents ?? null,
    ledgerPerAddonUnitNetCents: txRow?.ledgerPerAddonUnitNetCents ?? null,
    fallbackCoachPoolCents: txRow?.amountCents ?? avgCoachPerCreditFallback,
    fallbackCredits: Math.max(1, txRow?.sessionCreditsGranted ?? 1),
    consumedServiceUnits: consumed,
    addonUnitsAttributed,
  });

  await prisma.$transaction(async (tx) => {
    const conv = row.conversationId
      ? await tx.trainerClientConversation.findUnique({
          where: { id: row.conversationId },
          select: { id: true, bookingUnlimitedAfterPurchase: true },
        })
      : null;

    await tx.bookedTrainingSession.update({
      where: { id: row.id },
      data: {
        status: "CLIENT_CONFIRMED",
        fulfillmentStatus: "SCHEDULED",
        allocatedCoachServiceCents: netService,
        allocatedNetAddonCents: netAddon,
        sessionConsumedUnits: consumed,
        attributionStripePaymentIntentId: txRow?.stripePaymentIntentId ?? undefined,
        updatedAt: new Date(),
      },
    });

    if (conv && !conv.bookingUnlimitedAfterPurchase) {
      await tx.trainerClientConversation.update({
        where: { id: conv.id },
        data: { sessionCreditsUsed: { increment: 1 }, updatedAt: new Date() },
      });
    }
  });

  try {
    const emailCtx = await prisma.bookedTrainingSession.findUnique({
      where: { id: row.id },
      select: {
        sessionDelivery: true,
        videoConferenceJoinUrl: true,
        videoConferenceProvider: true,
        trainer: { select: { username: true, preferredName: true, firstName: true, lastName: true } },
        client: { select: { email: true, preferredName: true, firstName: true } },
      },
    });
    const to = emailCtx?.client?.email?.trim();
    if (to && emailCtx?.trainer) {
      const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://match-fit.net";
      const coachName =
        emailCtx.trainer.preferredName?.trim() ||
        [emailCtx.trainer.firstName, emailCtx.trainer.lastName].filter(Boolean).join(" ").trim() ||
        `@${emailCtx.trainer.username}`;
      const clientFirst = emailCtx.client.preferredName?.trim() || emailCtx.client.firstName.trim() || "there";
      const startLabel = row.scheduledStartAt.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const isVirtual = emailCtx.sessionDelivery === "VIRTUAL";
      const join = (emailCtx.videoConferenceJoinUrl ?? "").trim();
      const platform = videoConferenceProviderClientLabel(emailCtx.videoConferenceProvider);
      await sendTransactionalEmailIfAllowed({
        kind: "BOOKING_SESSION_CONFIRMED",
        to,
        audience: "CLIENT",
        clientId: args.clientId,
        variables: {
          firstName: clientFirst,
          coachName,
          startLabel,
          sessionDelivery: isVirtual ? "VIRTUAL" : "IN_PERSON",
          videoPlatform: platform,
          joinUrl: join,
          messagesThreadUrl: `${base}/client/dashboard/messages/${encodeURIComponent(emailCtx.trainer.username)}`,
        },
      });
    }
  } catch (e) {
    console.error("[booking confirm] client confirmation email failed:", e);
  }

  try {
    const clientRow = await prisma.client.findUnique({
      where: { id: args.clientId },
      select: { preferredName: true, firstName: true, username: true },
    });
    const startLabel = row.scheduledStartAt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const who =
      clientRow?.preferredName?.trim() ||
      clientRow?.firstName.trim() ||
      (clientRow?.username ? `@${clientRow.username}` : "A client");

    await prisma.trainerNotification.create({
      data: {
        trainerId: row.trainerId,
        kind: "CHAT",
        title: "Session booked",
        body: `${who} confirmed a session invite starting ${startLabel}.`,
        linkHref: clientRow?.username ? `/trainer/dashboard/messages/${encodeURIComponent(clientRow.username)}` : null,
      },
    });
  } catch (e) {
    console.error("[booking confirm] trainer notification failed:", e);
  }

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
