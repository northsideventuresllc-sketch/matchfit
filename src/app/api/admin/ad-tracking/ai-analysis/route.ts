import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { getAdminAiHistory, maybeTitleConversationFromFirstMessage, persistAdminAiTurn } from "@/lib/admin-analytics-ai";
import { runAdTrackingAi } from "@/lib/ad-tracking-ai";

const ADS_ACTION = "ads_analysis";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(64),
  model: z.string().max(64).optional(),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ messages: [] });

  const messages = await getAdminAiHistory(sess.adminId, { conversationId });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { message, conversationId, model } = parsed.data;
  const userContent = message.trim();

  await persistAdminAiTurn({
    administratorId: sess.adminId,
    conversationId,
    role: "user",
    content: userContent,
    actionType: ADS_ACTION,
  });
  await maybeTitleConversationFromFirstMessage(conversationId, userContent);

  const priorMessages = await getAdminAiHistory(sess.adminId, { conversationId, limit: 24 });
  const priorTurns = priorMessages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  let reply: string;
  try {
    reply = await runAdTrackingAi({ message: userContent, priorTurns, modelOverride: model });
  } catch (e) {
    console.error("[ad-tracking ai-analysis POST]", e);
    return NextResponse.json({ error: "Could not analyze ad performance right now." }, { status: 500 });
  }

  await persistAdminAiTurn({
    administratorId: sess.adminId,
    conversationId,
    role: "assistant",
    content: reply,
    actionType: ADS_ACTION,
  });

  return NextResponse.json({ reply, conversationId });
}
