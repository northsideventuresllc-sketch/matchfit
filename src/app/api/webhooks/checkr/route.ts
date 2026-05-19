import { applyCheckrReportToTrainer, resolveTrainerFromCheckrWebhook } from "@/lib/checkr/apply-report-outcome";
import { verifyCheckrWebhookSignature } from "@/lib/checkr/webhook-verify";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CheckrWebhookPayload = {
  type?: string;
  data?: { object?: Record<string, unknown> };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-checkr-signature") ?? req.headers.get("X-Checkr-Signature");

  if (!verifyCheckrWebhookSignature(rawBody, signature)) {
    console.warn("[Checkr webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: CheckrWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CheckrWebhookPayload;
import { parseCheckrWebhookPaidCents, recordCheckrBackgroundCheckPaid, verifyCheckrWebhookSignature } from "@/lib/checkr";
import { prisma } from "@/lib/prisma";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function checkrWebhookAuthorized(req: Request, rawBody: string): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const signature =
    req.headers.get("x-checkr-signature") ??
    req.headers.get("X-Checkr-Signature") ??
    req.headers.get("x-checkr-signature-256");
  return verifyCheckrWebhookSignature(rawBody, signature, secret);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!checkrWebhookAuthorized(req, raw)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = payload.type ?? "";
  if (!type.startsWith("report.") && type !== "invitation.completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const resolved = await resolveTrainerFromCheckrWebhook(payload);
    if (!resolved) {
      return NextResponse.json({ ok: true, unmatched: true });
    }

    const origin = getAppOriginFromRequest(req);
    await applyCheckrReportToTrainer({
      trainerId: resolved.trainerId,
      report: resolved.report,
      origin,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Checkr webhook]", e);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
  const parsed = parseCheckrWebhookPaidCents(body);
  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let trainerId = parsed.externalTrainerId?.trim();
  if (!trainerId && parsed.candidateId) {
    const prof = await prisma.trainerProfile.findFirst({
      where: { checkrCandidateId: parsed.candidateId },
      select: { trainerId: true },
    });
    trainerId = prof?.trainerId;
  }
  if (!trainerId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_trainer_mapping" });
  }

  await recordCheckrBackgroundCheckPaid({
    trainerId,
    vendorPaidCents: parsed.vendorPaidCents,
    reportId: parsed.reportId,
    candidateId: parsed.candidateId,
  });

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await maybeActivateTrainerDashboard(trainerId);

  return NextResponse.json({ ok: true });
}
