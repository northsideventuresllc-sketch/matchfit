import { NextResponse } from "next/server";
import { processResendInboundWebhook, verifyResendInboundWebhook } from "@/lib/resend-inbound-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const verified = verifyResendInboundWebhook(rawBody, {
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const result = await processResendInboundWebhook(rawBody);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[resend inbound]", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
