import { NextResponse } from "next/server";
import {
  getSupportInboxMessage,
  markSupportInboxMessageRead,
} from "@/lib/admin-support-inbox-graph";
import { requireAdminSession } from "@/lib/require-admin";

type Ctx = { params: Promise<{ messageId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { messageId } = await ctx.params;
  const loaded = await getSupportInboxMessage(messageId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 502 });
  }

  void markSupportInboxMessageRead(messageId);

  return NextResponse.json({ message: loaded.message });
}
