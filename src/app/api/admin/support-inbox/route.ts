import { NextResponse } from "next/server";
import {
  listSupportInboxMessages,
  markSupportMessageRead,
  replyToSupportMessage,
} from "@/lib/support-inbox-data";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await listSupportInboxMessages(100);
  return NextResponse.json({ messages });
}

export async function PATCH(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await markSupportMessageRead(body.id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; reply?: string };
  try {
    body = (await req.json()) as { id?: string; reply?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.reply?.trim()) {
    return NextResponse.json({ error: "id and reply required" }, { status: 400 });
  }

  const result = await replyToSupportMessage(body.id, body.reply);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, emailId: result.emailId });
}
