import "server-only";

import { prisma } from "@/lib/prisma";
import type { AdminPortalOverview } from "@/lib/admin-portal-data";
import type { AdminTrafficSnapshot } from "@/lib/site-analytics";

export type AdminAiAction =
  | "set_goal"
  | "goal_analysis"
  | "site_analysis"
  | "signup_recommendations"
  | "potential_rating_advice"
  | "revenue_projection_advice"
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

export type AdminAiProviderStatus = {
  configured: boolean;
  provider: "anthropic" | "openai" | null;
  model: string | null;
  message: string;
};

const PLAIN_LANGUAGE_RULES =
  "Write for a business operator, not an engineer. Use short paragraphs and bullet lists. Never dump JSON, raw metrics tables, or code. Reference numbers in plain English (e.g. 'about 120 visitors this week'). Keep responses under 350 words unless the user asks for depth.";

function fallbackVisitorInsights(traffic: AdminTrafficSnapshot): string {
  const topPage = traffic.topPages[0]?.path ?? "/";
  const topLink = traffic.topLinks[0]?.target ?? "sign-up CTAs";
  return [
    `In the last ${traffic.windowDays} days you had ${traffic.uniqueVisitors} unique visitors and ${traffic.pageViews} page views.`,
    `Top landing page: ${topPage} (${traffic.topPages[0]?.views ?? 0} views).`,
    `Most-clicked action: ${topLink} (${traffic.topLinks[0]?.clicks ?? 0} clicks).`,
    "Recommendations:",
    "• Tighten the hero CTA on your top landing page.",
    "• Add social proof near trainer and client signup buttons.",
    "• A/B test the headline on /client/sign-up.",
  ].join("\n");
}

function buildOperatorContext(
  overview: AdminPortalOverview,
  traffic: AdminTrafficSnapshot,
  goals: GoalRow[],
): string {
  const { platformSummary, funnel, finances } = overview;
  return [
    `Members: ${overview.userCounts.clientsTotal} clients (${overview.userCounts.clientsActive} active), ${overview.userCounts.trainersTotal} trainers (${overview.userCounts.trainersActive} active).`,
    `Revenue (lifetime): $${(overview.revenue.revenueCents / 100).toFixed(0)} gross, $${(overview.revenue.grossProfitCents / 100).toFixed(0)} platform profit.`,
    `Subscriptions: ${finances.activeSubscriptions} client platform subs, ${finances.premiumTrainers} premium trainers, ${finances.clientsInFreeTrial} clients in free trial.`,
    `Success rating: ${platformSummary.successRating.score.toFixed(1)}/10. Potential rating: ${platformSummary.potentialRating.score.toFixed(1)}/10 (+${platformSummary.potentialRating.uplift.toFixed(1)} uplift if key levers improve).`,
    `Realistic monthly revenue projection: $${(platformSummary.growthProjection.realisticMonthlyRevenueCents / 100).toFixed(0)} gross ($${(platformSummary.growthProjection.realisticMonthlyGrossProfitCents / 100).toFixed(0)} profit). Valuation range: $${(platformSummary.growthProjection.valuationLowCents / 100).toFixed(0)}–$${(platformSummary.growthProjection.valuationHighCents / 100).toFixed(0)} (early marketplace ARR multiple).`,
    `Traffic (${traffic.windowDays}d): ${traffic.uniqueVisitors} unique visitors, ${traffic.pageViews} page views, ${traffic.linkClicks} link clicks.`,
    `Funnel: ${funnel.clientSignupPageViews} client signup page views, ${funnel.trainerSignupPageViews} trainer signup page views, ${funnel.incompleteTrainerSignups} incomplete trainer signups.`,
    goals.length > 0
      ? `Active goals: ${goals.map((g) => g.title).join("; ")}.`
      : "Active goals: none yet.",
  ].join("\n");
}

export function getAdminAiProviderStatus(): AdminAiProviderStatus {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      configured: true,
      provider: "anthropic",
      model: process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL?.trim() || "claude-sonnet-4-20250514",
      message: "Anthropic is configured for admin analytics.",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      configured: true,
      provider: "openai",
      model: process.env.OPENAI_ADMIN_ANALYTICS_MODEL?.trim() || "gpt-4o-mini",
      message: "OpenAI is configured for admin analytics (Anthropic preferred when ANTHROPIC_API_KEY is set).",
    };
  }
  return {
    configured: false,
    provider: null,
    model: null,
    message:
      "No AI provider configured. Add ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY to enable AI responses. Built-in recommendations still appear on the dashboard.",
  };
}

async function callAnthropic(args: {
  model: string;
  system: string;
  user: string;
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 900,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      temperature: 0.4,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text?.trim();
  return text || null;
}

async function callOpenAi(args: {
  model: string;
  system: string;
  user: string;
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

async function callAdminAi(args: { system: string; user: string }): Promise<string | null> {
  const status = getAdminAiProviderStatus();
  if (!status.configured || !status.model) return null;

  if (status.provider === "anthropic") {
    const text = await callAnthropic({ model: status.model, system: args.system, user: args.user });
    if (text) return text;
  }

  if (status.provider === "openai" || process.env.OPENAI_API_KEY?.trim()) {
    const model = process.env.OPENAI_ADMIN_ANALYTICS_MODEL?.trim() || "gpt-4o-mini";
    return callOpenAi({ model, system: args.system, user: args.user });
  }

  return null;
}

function fallbackPotentialAdvice(overview: AdminPortalOverview): string {
  const recs = overview.platformSummary.potentialRating.recommendations
    .slice(0, 4)
    .map((r) => `• ${r.action}`)
    .join("\n");
  return [
    `Your success rating is ${overview.platformSummary.successRating.score.toFixed(1)}/10. With traffic, stability, and funnel levers optimized for this beta stage, potential rises to ${overview.platformSummary.potentialRating.score.toFixed(1)}/10.`,
    "Do this to get there:",
    recs,
  ].join("\n\n");
}

function fallbackRevenueAdvice(overview: AdminPortalOverview): string {
  const gp = overview.platformSummary.growthProjection;
  const recs = gp.revenueRecommendations
    .slice(0, 4)
    .map((r) => `• ${r.action}`)
    .join("\n");
  return [
    `Realistic monthly gross revenue this month: about $${(gp.realisticMonthlyRevenueCents / 100).toFixed(0)} ($${(gp.realisticMonthlyGrossProfitCents / 100).toFixed(0)} platform profit).`,
    `Indicative valuation range: $${(gp.valuationLowCents / 100).toFixed(0)}–$${(gp.valuationHighCents / 100).toFixed(0)} based on projected ARR.`,
    "Do this to get there:",
    recs,
  ].join("\n\n");
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

  const context = buildOperatorContext(args.overview, args.traffic, goals);
  const userPrompt = args.userMessage?.trim() || "Give concise, actionable guidance.";

  const systemPrompts: Record<AdminAiAction, string> = {
    set_goal: `You help a fitness marketplace operator define measurable KPI goals. ${PLAIN_LANGUAGE_RULES} Suggest a clear goal title, metric (platform_subscribers, unique_visitors, client_signups, revenue_cents, premium_trainers), and numeric target when possible.`,
    goal_analysis: `Analyze active goals against current metrics and traffic. ${PLAIN_LANGUAGE_RULES} Highlight gaps and the next 3 actions.`,
    site_analysis: `Analyze site traffic and funnel patterns for a fitness marketplace beta. ${PLAIN_LANGUAGE_RULES} Recommend concrete CTA and copy tests.`,
    signup_recommendations: `Recommend tactics to increase client and trainer sign-ups. ${PLAIN_LANGUAGE_RULES} Provide 3–5 prioritized bullets.`,
    potential_rating_advice: `Explain how to close the gap between the current success rating and the potential rating. ${PLAIN_LANGUAGE_RULES} End with a numbered "Do this to get here" list tied to traffic, stability, retention, and onboarding.`,
    revenue_projection_advice: `Explain the realistic monthly revenue projection and valuation range. ${PLAIN_LANGUAGE_RULES} End with a numbered "Do this to get here" list for revenue growth this month.`,
    freeform: `You are Match Fit's operator analytics copilot. ${PLAIN_LANGUAGE_RULES}`,
  };

  const aiText = await callAdminAi({
    system: systemPrompts[args.action],
    user: `Operator request:\n${userPrompt}\n\nPlatform snapshot:\n${context}`,
  });

  if (aiText) return aiText;

  const status = getAdminAiProviderStatus();
  if (args.action === "potential_rating_advice") {
    return `${fallbackPotentialAdvice(args.overview)}\n\n(${status.message})`;
  }
  if (args.action === "revenue_projection_advice") {
    return `${fallbackRevenueAdvice(args.overview)}\n\n(${status.message})`;
  }
  if (args.action === "site_analysis" || args.action === "signup_recommendations") {
    return `${fallbackVisitorInsights(args.traffic)}\n\n(${status.message})`;
  }
  if (args.action === "goal_analysis") {
    return goals.length === 0
      ? `No active goals yet. Use **Set a goal** to add a KPI, then run **Review my goals**.\n\n(${status.message})`
      : `You have ${goals.length} active goal(s). With ${args.overview.revenue.activePlatformSubscribers} live platform subscribers and ${args.traffic.uniqueVisitors} unique visitors (${args.traffic.windowDays}d), prioritize converting top landing page traffic into sign-ups.\n\n(${status.message})`;
  }
  if (args.action === "set_goal") {
    return `AI goal parsing is unavailable. Add ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY, then try again.\n\n(${status.message})`;
  }
  return `${fallbackVisitorInsights(args.traffic)}\n\n(${status.message})`;
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
