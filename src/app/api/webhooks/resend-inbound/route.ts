import { NextResponse } from "next/server";
import { storeSupportInboxMessage } from "@/lib/support-inbox-data";

const SUPPORT_ADDRESS = "support@match-fit.net";

type ResendInboundPayload = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
  };
};

export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization")?.trim();
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = (await req.json()) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = payload.data;
  if (!data) return NextResponse.json({ ok: true });

  const toList = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
  const isSupport = toList.some((t) => t.toLowerCase().includes(SUPPORT_ADDRESS));
  if (!isSupport) return NextResponse.json({ ok: true, skipped: true });

  await storeSupportInboxMessage({
    resendEmailId: data.email_id ?? null,
    fromEmail: data.from ?? "unknown",
    toEmail: toList[0] ?? SUPPORT_ADDRESS,
    subject: data.subject ?? "(no subject)",
    textBody: data.text ?? null,
    htmlBody: data.html ?? null,
  });

  return NextResponse.json({ ok: true });
}
