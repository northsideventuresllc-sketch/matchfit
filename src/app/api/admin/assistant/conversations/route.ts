import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminAiConversation, listAdminAiConversations } from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";

const createSchema = z.object({
  title: z.string().max(120).optional(),
});

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const conversations = await listAdminAiConversations(sess.adminId);
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const conversation = await createAdminAiConversation(sess.adminId, parsed.data.title?.trim() || "New conversation");
  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: 0,
    },
  });
}
