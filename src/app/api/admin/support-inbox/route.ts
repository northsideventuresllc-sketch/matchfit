import { NextResponse } from "next/server";
import { listSupportInboxMessages, markSupportMessageRead } from "@/lib/support-inbox-data";
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
