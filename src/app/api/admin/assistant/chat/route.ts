import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminPortalOverview } from "@/lib/admin-portal-data";
import {
  createAdminAiConversation,
  getAdminAiHistory,
  maybeTitleConversationFromFirstMessage,
  persistAdminAiTurn,
  runAdminAnalyticsAi,
  LEGACY_CONVERSATION_ID,
  type AdminAiAction,
} from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";
import { getAdminSiteTrafficSnapshot } from "@/lib/site-analytics";

const bodySchema = z.object({
  action: z.enum([
    "set_goal",
    "goal_analysis",
    "site_analysis",
    "signup_recommendations",
    "potential_rating_advice",
    "revenue_projection_advice",
    "freeform",
  ]),
  message: z.string().max(4000).optional(),
  goalTitle: z.string().max(200).optional(),
  goalDescription: z.string().max(2000).optional(),
  targetMetric: z.string().max(64).optional(),
  targetValue: z.number().int().positive().optional(),
  conversationId: z.string().max(64).optional(),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");

  const messages = await getAdminAiHistory(sess.adminId, {
    conversationId: conversationId === LEGACY_CONVERSATION_ID ? LEGACY_CONVERSATION_ID : conversationId,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { action, message, goalTitle, goalDescription, targetMetric, targetValue, conversationId } = parsed.data;

  let activeConversationId =
    conversationId && conversationId !== LEGACY_CONVERSATION_ID ? conversationId : undefined;

  if (!activeConversationId) {
    const created = await createAdminAiConversation(sess.adminId);
    activeConversationId = created.id;
  }

  if (action === "set_goal" && goalTitle?.trim()) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.adminGoal.create({
      data: {
        administratorId: sess.adminId,
        title: goalTitle.trim(),
        description: goalDescription?.trim() || message?.trim() || null,
        targetMetric: targetMetric?.trim() || null,
        targetValue: targetValue ?? null,
      },
    });
  }

  const userContent =
    action === "set_goal"
      ? message?.trim() || `New goal: ${goalTitle}. ${goalDescription ?? ""}`.trim()
      : message?.trim() || action.replace(/_/g, " ");

  if (userContent) {
    await persistAdminAiTurn({
      administratorId: sess.adminId,
      conversationId: activeConversationId,
      role: "user",
      content: userContent,
      actionType: action as AdminAiAction,
    });
    await maybeTitleConversationFromFirstMessage(activeConversationId, userContent);
  }

  const priorMessages = await getAdminAiHistory(sess.adminId, {
    conversationId: activeConversationId,
    limit: 24,
  });

  const history = priorMessages
    .slice(0, -1)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  const [overview, traffic] = await Promise.all([
    getAdminPortalOverview(),
    getAdminSiteTrafficSnapshot(7),
  ]);

  const reply = await runAdminAnalyticsAi({
    action: action as AdminAiAction,
    administratorId: sess.adminId,
    userMessage: userContent,
    goalTitle: goalTitle?.trim(),
    overview,
    traffic,
    history,
  });

  await persistAdminAiTurn({
    administratorId: sess.adminId,
    conversationId: activeConversationId,
    role: "assistant",
    content: reply,
    actionType: action as AdminAiAction,
  });

  return NextResponse.json({ reply, conversationId: activeConversationId });
}
