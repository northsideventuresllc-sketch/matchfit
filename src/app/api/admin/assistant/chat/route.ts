import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAdminPortalOverview,
} from "@/lib/admin-portal-data";
import {
  persistAdminAiTurn,
  runAdminAnalyticsAi,
  getAdminAiHistory,
  type AdminAiAction,
} from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";
import { getAdminSiteTrafficSnapshot } from "@/lib/site-analytics";

const bodySchema = z.object({
  action: z.enum(["set_goal", "goal_analysis", "site_analysis", "signup_recommendations", "freeform"]),
  message: z.string().max(4000).optional(),
  goalTitle: z.string().max(200).optional(),
  goalDescription: z.string().max(2000).optional(),
  targetMetric: z.string().max(64).optional(),
  targetValue: z.number().int().positive().optional(),
});

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const messages = await getAdminAiHistory(sess.adminId);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { action, message, goalTitle, goalDescription, targetMetric, targetValue } = parsed.data;

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
      role: "user",
      content: userContent,
      actionType: action as AdminAiAction,
    });
  }

  const [overview, traffic] = await Promise.all([
    getAdminPortalOverview(),
    getAdminSiteTrafficSnapshot(7),
  ]);

  const reply = await runAdminAnalyticsAi({
    action: action as AdminAiAction,
    administratorId: sess.adminId,
    userMessage: userContent,
    overview,
    traffic,
  });

  await persistAdminAiTurn({
    administratorId: sess.adminId,
    role: "assistant",
    content: reply,
    actionType: action as AdminAiAction,
  });

  return NextResponse.json({ reply });
}
