import { NextResponse } from "next/server";
import { z } from "zod";
import { replyToSupportInboxMessage } from "@/lib/admin-support-inbox-graph";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});

type Ctx = { params: Promise<{ messageId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
  }

  const { messageId } = await ctx.params;
  const sent = await replyToSupportInboxMessage({
    messageId,
    body: parsed.data.body,
  });
  if ("error" in sent) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
