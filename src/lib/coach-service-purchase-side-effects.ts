import { parseClientNotificationPrefsJson } from "@/lib/client-notification-prefs";
import { parseTrainerNotificationPrefsJson } from "@/lib/trainer-notification-prefs";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { sendWebPushToClient, sendWebPushToTrainer } from "@/lib/web-push-send";

/**
 * Receipt email / Web Push plus in-app notifications for client and trainer — runs once per service transaction (Stripe-retries safe).
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
        deidentifiedAt: true,
        notificationPrefsJson: true,
      },
    }),
    prisma.trainer.findUnique({
      where: { id: snap.trainerId },
      select: { username: true, id: true, email: true, notificationPrefsJson: true },
    }),
  ]);

  if (!clientRow?.email?.trim() || clientRow.deidentifiedAt || !trainerRow) return;

  const prefs = parseClientNotificationPrefsJson(clientRow.notificationPrefsJson);
  const receiptEmail = prefs.coachPurchaseReceiptEmail;
  const receiptPush = prefs.coachPurchaseReceiptPush;

  const clientLabel = clientRow.preferredName?.trim() || clientRow.firstName.trim() || "there";
  const serviceLabel =
    snap.purchaseLabelSnapshot?.trim() ||
    (snap.serviceId?.trim() ? `Coach service (${snap.serviceId.trim()})` : "Coach package");
  const amountUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Math.max(0, snap.amountCents) / 100,
  );

  const profileHref = `/trainers/${encodeURIComponent(trainerRow.username)}`;
  const baseUrl = appBaseUrlForEmail();

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

  if (receiptEmail) {
    try {
      await sendTransactionalEmailIfAllowed({
        kind: "PURCHASE_CONFIRMATION",
        to: clientRow.email.trim(),
        audience: "CLIENT",
        clientId: clientRow.id,
        variables: {
          dashboardUrl: `${baseUrl}/client`,
          itemLabel: serviceLabel,
          amount: amountUsd,
          trainerUsername: trainerRow.username,
          referenceId: snap.id,
        },
      });
    } catch (e) {
      console.error("[coach purchase] receipt email failed:", e);
    }
  }
  if (receiptPush && prefs.pushBilling) {
    void sendWebPushToClient(clientRow.id, {
      title: "Coach purchase complete",
      body: `Payment with @${trainerRow.username} — ${serviceLabel} (${amountUsd}).`,
      url: profileHref,
    });
  }

  const trainerPrefs = parseTrainerNotificationPrefsJson(trainerRow.notificationPrefsJson);
  if (trainerPrefs.pushBilling) {
    void sendWebPushToTrainer(trainerRow.id, {
      title: "New package sale",
      body: `${clientLabel} bought ${serviceLabel} (${amountUsd}).`,
      url: `/trainer/dashboard/messages/${encodeURIComponent(clientRow.username)}`,
    });
  }

  if (trainerRow.email?.trim()) {
    try {
      await sendTransactionalEmailIfAllowed({
        kind: "COACH_PACKAGE_SALE",
        to: trainerRow.email.trim(),
        audience: "TRAINER",
        trainerId: trainerRow.id,
        variables: {
          trainerDashboardUrl: `${baseUrl}/trainer/dashboard`,
          interestsUrl: `${baseUrl}/trainer/dashboard/interests`,
          clientUsername: clientRow.username,
          itemLabel: serviceLabel,
          amount: amountUsd,
        },
      });
    } catch (e) {
      console.error("[coach purchase] trainer sale email failed:", e);
    }
  }
}
