import { parseClientNotificationPrefsJson } from "@/lib/client-notification-prefs";
import { deliverTransactionalSms } from "@/lib/deliver-otp";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend-client";

async function composeCoachPurchaseReceiptLines(args: {
  clientLabel: string;
  trainerUsername: string;
  serviceLabel: string;
  amountUsd: string;
  transactionId: string;
}): Promise<{ subject: string; body: string; smsBody: string }> {
  const subject = `Receipt: coach package with @${args.trainerUsername}`;
  const body = [
    `Hi ${args.clientLabel},`,
    ``,
    `Thanks for your purchase on Match Fit.`,
    ``,
    `Coach: @${args.trainerUsername}`,
    `Package: ${args.serviceLabel}`,
    `Coach service amount (before card processing fees): ${args.amountUsd}`,
    `Reference: ${args.transactionId}`,
    ``,
    `You’ll also find this purchase in your Match Fit notifications.`,
  ].join("\n");
  const smsBody = `Match Fit: Payment received — ${args.serviceLabel} with @${args.trainerUsername} (${args.amountUsd}).`;
  return { subject, body, smsBody };
}

/**
 * Receipt email/SMS plus in-app notifications for client and trainer — runs once per service transaction (Stripe-retries safe).
 */
export async function deliverCoachServicePurchaseSideEffects(transactionId: string): Promise<void> {
  const snap = await prisma.trainerClientServiceTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      purchaseSideEffectsAt: true,
      clientId: true,
      trainerId: true,
      amountCents: true,
      serviceId: true,
      purchaseLabelSnapshot: true,
    },
  });
  if (!snap || snap.purchaseSideEffectsAt) return;

  const [clientRow, trainerRow] = await Promise.all([
    prisma.client.findUnique({
      where: { id: snap.clientId },
      select: {
        id: true,
        username: true,
        preferredName: true,
        firstName: true,
        email: true,
        phone: true,
        deidentifiedAt: true,
        notificationPrefsJson: true,
      },
    }),
    prisma.trainer.findUnique({
      where: { id: snap.trainerId },
      select: { username: true },
    }),
  ]);

  if (!clientRow?.email?.trim() || clientRow.deidentifiedAt || !trainerRow) return;

  const prefs = parseClientNotificationPrefsJson(clientRow.notificationPrefsJson);
  const receiptMode = prefs.coachPurchaseReceiptDelivery;

  const clientLabel = clientRow.preferredName?.trim() || clientRow.firstName.trim() || "there";
  const serviceLabel =
    snap.purchaseLabelSnapshot?.trim() ||
    (snap.serviceId?.trim() ? `Coach service (${snap.serviceId.trim()})` : "Coach package");
  const amountUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Math.max(0, snap.amountCents) / 100,
  );
  const receipt = await composeCoachPurchaseReceiptLines({
    clientLabel,
    trainerUsername: trainerRow.username,
    serviceLabel,
    amountUsd,
    transactionId: snap.id,
  });

  const profileHref = `/trainers/${encodeURIComponent(trainerRow.username)}`;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.trainerClientServiceTransaction.updateMany({
      where: { id: transactionId, purchaseSideEffectsAt: null },
      data: { purchaseSideEffectsAt: new Date() },
    });
    if (claimed.count !== 1) return;

    await tx.clientNotification.create({
      data: {
        clientId: clientRow.id,
        kind: "BILLING",
        title: "Coach purchase complete",
        body: `Your payment with @${trainerRow.username} went through (${amountUsd} coach package before processing fees): ${serviceLabel}.`,
        linkHref: profileHref,
      },
    });

    await tx.trainerNotification.create({
      data: {
        trainerId: snap.trainerId,
        kind: "BILLING",
        title: "New client package sale",
        body: `${clientLabel} (${clientRow.username}) bought: ${serviceLabel} (${amountUsd} package before processing fees).`,
        linkHref: `/trainer/dashboard/messages/${encodeURIComponent(clientRow.username)}`,
      },
    });
  });

  const claimedRow = await prisma.trainerClientServiceTransaction.findUnique({
    where: { id: transactionId },
    select: { purchaseSideEffectsAt: true },
  });
  if (!claimedRow?.purchaseSideEffectsAt) return;

  if (receiptMode === "EMAIL") {
    try {
      await sendResendEmail({
        to: clientRow.email.trim(),
        subject: receipt.subject,
        text: receipt.body,
      });
    } catch (e) {
      console.error("[coach purchase] receipt email failed:", e);
    }
  } else if (receiptMode === "SMS") {
    try {
      await deliverTransactionalSms(clientRow.phone?.trim() ?? "", receipt.smsBody);
    } catch (e) {
      console.error("[coach purchase] receipt SMS failed:", e);
    }
  }
}
