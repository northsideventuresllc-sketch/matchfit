import { NextResponse } from "next/server";
import { parseCheckrWebhookPaidCents, recordCheckrBackgroundCheckPaid } from "@/lib/checkr";
import { prisma } from "@/lib/prisma";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

export const dynamic = "force-dynamic";

function verifyCheckrSignature(): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  // Checkr signs webhooks — wire HMAC verification when secret is configured.
  return true;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyCheckrSignature()) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
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
