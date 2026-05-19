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
}
