import "server-only";

import { prisma } from "@/lib/prisma";
import type { AdminTrafficSnapshot } from "@/lib/site-analytics";
import type { AdminPortalOverview } from "@/lib/admin-portal-data";

export type AdminAiAction =
  | "set_goal"
  | "goal_analysis"
  | "site_analysis"
  | "signup_recommendations"
  | "freeform";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  targetMetric: string | null;
  targetValue: number | null;
  deadline: Date | null;
  status: string;
};

function fallbackVisitorInsights(traffic: AdminTrafficSnapshot): string {
  const topPage = traffic.topPages[0]?.path ?? "/";
  const topLink = traffic.topLinks[0]?.target ?? "sign-up CTAs";
  return [
    `In the last ${traffic.windowDays} days you had ${traffic.uniqueVisitors} unique visitors and ${traffic.pageViews} page views.`,
    `Top landing page: ${topPage} (${traffic.topPages[0]?.uniqueVisitors ?? 0} unique viewers).`,
    `Most-clicked action: ${topLink}.`,
    "Recommendations: tighten the hero CTA on your top landing page, add social proof near trainer/client signup buttons, and A/B test the headline on /client/sign-up.",
  ].join("\n\n");
}

function buildContextSummary(overview: AdminPortalOverview, traffic: AdminTrafficSnapshot, goals: GoalRow[]): string {
  return JSON.stringify(
    {
      members: overview.userCounts,
      revenue: {
        revenueCents: overview.revenue.revenueCents,
        grossProfitCents: overview.revenue.grossProfitCents,
        platformSubscribers: overview.revenue.activePlatformSubscribers,
        premiumTrainers: overview.revenue.activeTrainerPremiumSubscribers,
      },
      traffic: {
        uniqueVisitors: traffic.uniqueVisitors,
        topPages: traffic.topPages,
        topLinks: traffic.topLinks,
      },
      goals: goals.map((g) => ({
        title: g.title,
        targetMetric: g.targetMetric,
        targetValue: g.targetValue,
        deadline: g.deadline?.toISOString() ?? null,
      })),
      recentSignupCount: overview.recentSignups.length,
    },
    null,
    2,
  );
}

export async function runAdminAnalyticsAi(args: {
  action: AdminAiAction;
  administratorId: string;
  userMessage?: string;
  overview: AdminPortalOverview;
  traffic: AdminTrafficSnapshot;
}): Promise<string> {
  const goals = await prisma.adminGoal.findMany({
    where: { administratorId: args.administratorId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      description: true,
      targetMetric: true,
      targetValue: true,
      deadline: true,
      status: true,
    },
  });

  const key = process.env.OPENAI_API_KEY?.trim();
  const context = buildContextSummary(args.overview, args.traffic, goals);

  if (!key) {
    if (args.action === "site_analysis" || args.action === "signup_recommendations") {
      return fallbackVisitorInsights(args.traffic);
    }
    if (args.action === "goal_analysis") {
      return goals.length === 0
        ? "No active goals yet. Use **Set Goal** to add a KPI, then run Goal Analysis."
        : `You have ${goals.length} active goal(s). With ${args.overview.revenue.activePlatformSubscribers} live platform subscribers and ${args.traffic.uniqueVisitors} unique visitors (${args.traffic.windowDays}d), focus on converting top landing page traffic into sign-ups.`;
    }
    if (args.action === "set_goal") {
      return "OpenAI is not configured. Add OPENAI_API_KEY to enable AI goal parsing. You can still create goals manually via the API.";
    }
    return args.userMessage?.trim()
      ? `AI unavailable (no OPENAI_API_KEY). Context snapshot:\n${context}`
      : fallbackVisitorInsights(args.traffic);
  }

  const systemPrompts: Record<AdminAiAction, string> = {
    set_goal:
      "You help a fitness marketplace operator define measurable KPI goals. Parse the user's goal and respond with a concise confirmation plus suggested targetMetric (platform_subscribers|unique_visitors|client_signups|revenue_cents|premium_trainers) and numeric targetValue if inferable.",
    goal_analysis:
      "Analyze the operator's active goals against current platform metrics and site traffic. Be specific, actionable, and honest about gaps. Reference numbers from the JSON context.",
    site_analysis:
      "Analyze site traffic patterns for a fitness marketplace beta. Identify funnel leaks and recommend concrete CTA/copy tests. Use fitness-industry best practices.",
    signup_recommendations:
      "Given traffic and conversion context, recommend 3-5 tactics to increase client and trainer sign-ups for an Atlanta beta launch.",
    freeform: "You are Match Fit's operator analytics copilot. Use the JSON context and answer helpfully.",
  };

  const userContent =
    args.action === "set_goal" || args.action === "freeform"
      ? `${args.userMessage ?? ""}\n\nContext:\n${context}`
      : `Context:\n${context}\n\n${args.userMessage ?? ""}`.trim();

  const model = process.env.OPENAI_ADMIN_ANALYTICS_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompts[args.action] },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    return fallbackVisitorInsights(args.traffic);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || fallbackVisitorInsights(args.traffic);
}

export async function persistAdminAiTurn(args: {
  administratorId: string;
  role: "user" | "assistant";
  content: string;
  actionType?: AdminAiAction;
}): Promise<void> {
  await prisma.adminAiMessage.create({
    data: {
      administratorId: args.administratorId,
      role: args.role,
      content: args.content,
      actionType: args.actionType,
    },
  });
}

export async function getAdminAiHistory(administratorId: string, limit = 40) {
  const rows = await prisma.adminAiMessage.findMany({
    where: { administratorId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, role: true, content: true, actionType: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
