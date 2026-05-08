import { prisma } from "@/lib/prisma";
import { refundCentsViaStripePaymentIntent } from "@/lib/session-check-in";

export type ClientDiyGovernanceGate =
  | {
      kind: "extension_decision";
      engagementId: string;
      trainerUsername: string;
      hoursRequested: number;
      decideByIso: string;
    }
  | {
      kind: "post_due_attest";
      engagementId: string;
      trainerUsername: string;
      dueIso: string;
    };

/** Login / dashboard blocking prompts for DIY extension approval or post-deadline attestation. */
export async function getClientDiyGovernanceGate(clientId: string): Promise<ClientDiyGovernanceGate | null> {
  const now = new Date();
  const ext = await prisma.diyPlanEngagement.findFirst({
    where: {
      clientId,
      extensionStatus: "PENDING",
      extensionRequestedAt: { not: null },
      extensionClientDecisionByAt: { not: null, gt: now },
    },
    orderBy: { extensionRequestedAt: "desc" },
    include: { trainer: { select: { username: true } } },
  });
  if (ext?.extensionClientDecisionByAt != null && ext.extensionHoursRequested != null) {
    return {
      kind: "extension_decision",
      engagementId: ext.id,
      trainerUsername: ext.trainer.username,
      hoursRequested: ext.extensionHoursRequested,
      decideByIso: ext.extensionClientDecisionByAt.toISOString(),
    };
  }

  const late = await prisma.diyPlanEngagement.findFirst({
    where: {
      clientId,
      status: "PENDING_DELIVERY",
      wallClockDeliverableDueAt: { not: null, lt: now },
      trainerReceivableLoggedAt: null,
      firstDeliveredAt: null,
      clientPostDueAttestation: null,
    },
    orderBy: { wallClockDeliverableDueAt: "asc" },
    include: { trainer: { select: { username: true } } },
  });
  if (late?.wallClockDeliverableDueAt) {
    return {
      kind: "post_due_attest",
      engagementId: late.id,
      trainerUsername: late.trainer.username,
      dueIso: late.wallClockDeliverableDueAt.toISOString(),
    };
  }
  return null;
}

export async function clientPostDueAttestDiy(args: {
  clientId: string;
  engagementId: string;
  received: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const eng = await prisma.diyPlanEngagement.findFirst({
    where: { id: args.engagementId, clientId: args.clientId },
    select: {
      id: true,
      trainerId: true,
      wallClockDeliverableDueAt: true,
      trainerReceivableLoggedAt: true,
      firstDeliveredAt: true,
      clientPostDueAttestation: true,
      status: true,
    },
  });
  if (!eng) return { error: "Not found." };
  const now = new Date();
  if (
    eng.status !== "PENDING_DELIVERY" ||
    !eng.wallClockDeliverableDueAt ||
    now.getTime() < eng.wallClockDeliverableDueAt.getTime() ||
    eng.trainerReceivableLoggedAt ||
    eng.firstDeliveredAt ||
    eng.clientPostDueAttestation
  ) {
    return { error: "Not eligible for this attestation." };
  }

  if (args.received) {
    await prisma.diyPlanEngagement.update({
      where: { id: eng.id },
      data: {
        clientPostDueAttestation: "YES_MARK_DONE",
        clientPostDueAttestedAt: now,
        trainerUrgentUploadDeadlineAt: null,
        updatedAt: now,
      },
    });
    await prisma.trainerNotification.create({
      data: {
        trainerId: eng.trainerId,
        kind: "CHAT",
        title: "DIY — client confirms delivery",
        body: "Your client indicated the DIY deliverable was satisfied after the calendar deadline. Log the deliverable and receivable handshake in Client Management when ready.",
        linkHref: "/trainer/dashboard/client-management",
      },
    });
  } else {
    const urgentUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await prisma.diyPlanEngagement.update({
      where: { id: eng.id },
      data: {
        clientPostDueAttestation: "NO_NOT_RECEIVED",
        clientPostDueAttestedAt: now,
        trainerUrgentUploadDeadlineAt: urgentUntil,
        updatedAt: now,
      },
    });
    await prisma.trainerNotification.create({
      data: {
        trainerId: eng.trainerId,
        kind: "COMPLIANCE",
        title: "DIY — upload or extension within 24h",
        body: "The client reported they did not receive the DIY deliverable after the deadline. Upload the deliverable in Client Management or request a time extension within 24 hours.",
        linkHref: "/trainer/dashboard/client-management",
      },
    });
  }
  return { ok: true };
}

export async function trainerRequestDiyExtension(args: {
  trainerId: string;
  clientUsername: string;
  hoursRequested: number;
}): Promise<{ ok: true } | { error: string }> {
  const hours = Math.max(0.25, Math.min(168, Number(args.hoursRequested) || 0));
  if (!Number.isFinite(hours) || hours < 0.25) return { error: "Hours must be between 0.25 and 168." };

  const client = await prisma.client.findUnique({ where: { username: args.clientUsername.trim() }, select: { id: true } });
  if (!client) return { error: "Client not found." };

  const now = new Date();
  const eng = await prisma.diyPlanEngagement.findFirst({
    where: { trainerId: args.trainerId, clientId: client.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientId: true,
      clientPostDueAttestation: true,
      trainerReceivableLoggedAt: true,
      extensionStatus: true,
      trainerUrgentUploadDeadlineAt: true,
    },
  });
  if (!eng) return { error: "No DIY engagement." };
  if (eng.trainerReceivableLoggedAt) return { error: "Deliverable already logged." };
  if (eng.clientPostDueAttestation !== "NO_NOT_RECEIVED") {
    return { error: "Extensions are only available after the client reports non-delivery past the calendar deadline." };
  }
  if (eng.extensionStatus === "PENDING") return { error: "An extension is already pending client approval." };
  if (eng.trainerUrgentUploadDeadlineAt && now.getTime() > eng.trainerUrgentUploadDeadlineAt.getTime()) {
    return { error: "The 24-hour upload/extension window has expired. Contact Match Fit support." };
  }

  const decideBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await prisma.diyPlanEngagement.update({
    where: { id: eng.id },
    data: {
      extensionHoursRequested: hours,
      extensionRequestedAt: now,
      extensionClientDecisionByAt: decideBy,
      extensionStatus: "PENDING",
      updatedAt: now,
    },
  });

  await prisma.clientNotification.create({
    data: {
      clientId: eng.clientId,
      kind: "BILLING",
      title: "DIY extension requested",
      body: `Your coach requested more time (${hours} hours) to upload your DIY deliverable. Approve or decline in Service Management within 48 hours — if you take no action, it is auto-approved.`,
      linkHref: "/client/dashboard/service-management",
    },
  });

  return { ok: true };
}

export async function clientDecideDiyExtension(args: {
  clientId: string;
  engagementId: string;
  approved: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const eng = await prisma.diyPlanEngagement.findFirst({
    where: { id: args.engagementId, clientId: args.clientId },
    include: {
      sourceServiceTransaction: {
        select: { ledgerNetAfterFeesCents: true, stripePaymentIntentId: true },
      },
    },
  });
  if (!eng) return { error: "Not found." };
  if (eng.extensionStatus !== "PENDING") return { error: "No pending extension." };
  const now = new Date();
  if (eng.extensionClientDecisionByAt && now.getTime() > eng.extensionClientDecisionByAt.getTime()) {
    return { error: "Decision window closed — refresh the page." };
  }

  if (args.approved) {
    const h = Math.max(0, eng.extensionHoursRequested ?? 0);
    const newDeadline = new Date(eng.firstDeliverByAt.getTime() + h * 60 * 60 * 1000);
    await prisma.diyPlanEngagement.update({
      where: { id: eng.id },
      data: {
        extensionStatus: "APPROVED",
        extendedDeliverableDueAt: newDeadline,
        firstDeliverByAt: newDeadline,
        trainerUrgentUploadDeadlineAt: null,
        updatedAt: now,
      },
    });
    await prisma.trainerNotification.create({
      data: {
        trainerId: eng.trainerId,
        kind: "CHAT",
        title: "DIY extension approved",
        body: "Your client approved the extra time to upload the DIY deliverable.",
        linkHref: "/trainer/dashboard/client-management",
      },
    });
    return { ok: true };
  }

  const net = Math.max(0, eng.sourceServiceTransaction?.ledgerNetAfterFeesCents ?? 0);
  const pi = eng.sourceServiceTransaction?.stripePaymentIntentId?.trim();
  if (net > 0 && pi) {
    const res = await refundCentsViaStripePaymentIntent({
      paymentIntentId: pi,
      amountCents: net,
      idempotencyKey: `diy-ext-decline:${eng.id}`,
    });
    if ("error" in res) return { error: `Refund failed: ${res.error}` };
  }

  await prisma.diyPlanEngagement.update({
    where: { id: eng.id },
    data: {
      extensionStatus: "DECLINED",
      status: "MISSED",
      trainerUrgentUploadDeadlineAt: null,
      updatedAt: now,
    },
  });

  await prisma.trainerNotification.create({
    data: {
      trainerId: eng.trainerId,
      kind: "BILLING",
      title: "DIY extension declined",
      body: `The client declined your extension. A refund of the net DIY purchase amount (${(net / 100).toFixed(2)} USD) was requested where Stripe allows; administrative and processing portions may be retained per Terms.`,
      linkHref: "/trainer/dashboard/client-management",
    },
  });

  return { ok: true };
}
