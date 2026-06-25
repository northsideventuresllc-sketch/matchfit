import "server-only";

import {
  sanitizeAssistantMessageForDisplay,
  type AdminAiAction,
} from "@/lib/admin-assistant-labels";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus, resolveAnthropicApiKey } from "@/lib/ai-vault";
import { resolveClaudeModelForComplexity } from "@/lib/ai-vault/models";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { prisma } from "@/lib/prisma";
import type { AdminTrafficSnapshot } from "@/lib/site-analytics";
import type { AdminPortalOverview } from "@/lib/admin-portal-data";

export type { AdminAiAction };

export const LEGACY_CONVERSATION_ID = "legacy";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  targetMetric: string | null;
  targetValue: number | null;
  deadline: Date | null;
  status: string;
};

type HistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AdminAiProviderId = "anthropic" | "openai";

export type AdminAiProviderStatus = {
  provider: AdminAiProviderId;
  configured: boolean;
  working: boolean;
  model: string;
  message: string;
};

function fallbackVisitorInsights(traffic: AdminTrafficSnapshot): string {
  const topPage = traffic.topPages[0]?.path ?? "/";
  const topLink = traffic.topLinks[0]?.target ?? "sign-up buttons";
  return [
    `Over the last ${traffic.windowDays} days, Match Fit had ${traffic.uniqueVisitors.toLocaleString()} unique visitors and ${traffic.pageViews.toLocaleString()} page views.`,
    `Your busiest page was ${topPage} (${(traffic.topPages[0]?.views ?? 0).toLocaleString()} views).`,
    `The most-clicked action was ${topLink} (${(traffic.topLinks[0]?.clicks ?? 0).toLocaleString()} clicks).`,
    "Recommendations:",
    "• Tighten the hero call-to-action on your top landing page.",
    "• Add social proof near client and trainer sign-up buttons.",
    "• A/B test the headline on /client/sign-up.",
  ].join("\n\n");
}

function fallbackGoalAnalysis(
  goals: GoalRow[],
  overview: AdminPortalOverview,
  traffic: AdminTrafficSnapshot,
): string {
  if (goals.length === 0) {
    return [
      "You do not have any active goals yet.",
      "Use **Set a KPI goal** to add a target (for example, platform subscribers or weekly sign-ups), then run **Goal check-in** for a progress review.",
    ].join("\n\n");
  }

  const goalList = goals
    .slice(0, 5)
    .map((g) => `• ${g.title}${g.targetValue != null ? ` — target ${g.targetValue.toLocaleString()}` : ""}`)
    .join("\n");

  return [
    `You have ${goals.length} active goal${goals.length === 1 ? "" : "s"}:`,
    goalList,
    "",
    `Right now the platform shows ${overview.revenue.activePlatformSubscribers.toLocaleString()} live subscribers and ${traffic.uniqueVisitors.toLocaleString()} unique visitors in the last ${traffic.windowDays} days.`,
    "Focus this week on converting your top landing-page traffic into sign-ups, then revisit goal pacing after the next traffic spike.",
  ].join("\n");
}

function fallbackSetGoalReply(goalTitle?: string): string {
  if (goalTitle?.trim()) {
    return [
      `Got it — **${goalTitle.trim()}** is saved as an active goal.`,
      "Run **Goal check-in** anytime to see how you are tracking against live platform and traffic numbers.",
    ].join("\n\n");
  }
  return "Describe the goal you want to track (for example, “Reach 50 platform subscribers by September”), and I will help you turn it into a measurable KPI.";
}

function fallbackFreeformReply(traffic: AdminTrafficSnapshot): string {
  return [
    "The AI assistant is temporarily offline, so here is a quick traffic snapshot instead:",
    fallbackVisitorInsights(traffic),
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
      successMetrics: {
        currentScore: overview.platformSummary.successRating.score,
        potentialRatingLow: overview.platformSummary.potentialRating.scoreLow,
        potentialRatingHigh: overview.platformSummary.potentialRating.scoreHigh,
        potentialScenarios: overview.platformSummary.potentialRating.scenarios.map((s) => ({
          id: s.id,
          label: s.label,
          score: s.score,
        })),
        valuationCents: overview.platformSummary.valuation.valuationCents,
        valuationMultiple: overview.platformSummary.valuation.revenueMultiple,
      },
      statsComputedAt: overview.computedAt,
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
      memberOverview: overview.memberOverview,
    },
    null,
    2,
  );
}

/** Sync env check for server pages and outreach/content AI helpers (no live probe). Prefer {@link getAdminAiProviderStatusAsync} when platform_secrets may hold keys. */
export function getAdminAiProviderStatus(): AdminAiProviderStatus {
  const vault = getAiVaultStatus();
  const model = resolveClaudeModelForComplexity(inferTaskComplexity({ user: "admin analytics status" }));
  if (!vault.configured) {
    return {
      provider: "anthropic",
      configured: false,
      working: false,
      model,
      message: vault.message,
    };
  }

  return {
    provider: "anthropic",
    configured: vault.anthropic || vault.geminiPrimary || vault.geminiBackup,
    working: false,
    model,
    message: vault.message,
  };
}

export async function getAdminAiProviderStatusAsync(): Promise<AdminAiProviderStatus> {
  await hydratePlatformEnvFromDatabase();
  return getAdminAiProviderStatus();
}

async function probeAnthropicProvider(model: string, key: string): Promise<AdminAiProviderStatus> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        provider: "anthropic",
        configured: true,
        working: false,
        model,
        message:
          "Anthropic key is present but the API rejected the request. Quick prompts will use built-in fallbacks.",
      };
    }

    return {
      provider: "anthropic",
      configured: true,
      working: true,
      model,
      message: `Connected to Anthropic (Claude). Full AI answers are available via ${model}.`,
    };
  } catch {
    return {
      provider: "anthropic",
      configured: true,
      working: false,
      model,
      message:
        "Anthropic key is present but the service could not be reached. Quick prompts will use built-in fallbacks.",
    };
  }
}

function fallbackForAction(
  action: AdminAiAction,
  args: {
    goals: GoalRow[];
    overview: AdminPortalOverview;
    traffic: AdminTrafficSnapshot;
    userMessage?: string;
    goalTitle?: string;
  },
): string {
  switch (action) {
    case "site_analysis":
    case "signup_recommendations":
      return fallbackVisitorInsights(args.traffic);
    case "goal_analysis":
      return fallbackGoalAnalysis(args.goals, args.overview, args.traffic);
    case "set_goal":
      return fallbackSetGoalReply(args.goalTitle ?? args.userMessage);
    case "freeform":
    default:
      return args.userMessage?.trim()
        ? fallbackFreeformReply(args.traffic)
        : fallbackVisitorInsights(args.traffic);
  }
}

export async function probeAdminAiProvider(): Promise<AdminAiProviderStatus> {
  await hydratePlatformEnvFromDatabase();
  const vault = getAiVaultStatus();
  const model = resolveClaudeModelForComplexity(inferTaskComplexity({ user: "admin analytics probe" }));

  if (!vault.anthropic) {
    return {
      provider: "anthropic",
      configured: vault.configured,
      working: false,
      model,
      message: vault.configured
        ? "Gemini fallback is configured. Claude is not available in the AI Vault."
        : "No AI provider is configured. Quick prompts still return built-in traffic insights.",
    };
  }

  const key = resolveAnthropicApiKey();
  if (!key) {
    return {
      provider: "anthropic",
      configured: false,
      working: false,
      model,
      message: "Anthropic is not configured. Quick prompts still return built-in traffic insights.",
    };
  }

  return probeAnthropicProvider(model, key);
}

export async function createAdminAiConversation(administratorId: string, title = "New conversation") {
  return prisma.adminAiConversation.create({
    data: { administratorId, title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function touchAdminAiConversation(conversationId: string) {
  await prisma.adminAiConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function maybeTitleConversationFromFirstMessage(conversationId: string, userContent: string) {
  const convo = await prisma.adminAiConversation.findUnique({
    where: { id: conversationId },
    select: { title: true },
  });
  if (!convo || (convo.title !== "New conversation" && convo.title.trim().length > 0)) return;

  const title = userContent.trim().slice(0, 72) || "New conversation";
  await prisma.adminAiConversation.update({
    where: { id: conversationId },
    data: { title },
  });
}

export async function listAdminAiConversations(administratorId: string, limit = 30) {
  const [conversations, legacyCount] = await Promise.all([
    prisma.adminAiConversation.findMany({
      where: { administratorId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.adminAiMessage.count({
      where: { administratorId, conversationId: null },
    }),
  ]);

  const rows = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c._count.messages,
  }));

  if (legacyCount > 0) {
    const oldestLegacy = await prisma.adminAiMessage.findFirst({
      where: { administratorId, conversationId: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const newestLegacy = await prisma.adminAiMessage.findFirst({
      where: { administratorId, conversationId: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    rows.push({
      id: LEGACY_CONVERSATION_ID,
      title: "Earlier messages",
      createdAt: oldestLegacy?.createdAt.toISOString() ?? new Date().toISOString(),
      updatedAt: newestLegacy?.createdAt.toISOString() ?? new Date().toISOString(),
      messageCount: legacyCount,
    });
  }

  return rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getAdminAiHistory(
  administratorId: string,
  options?: { conversationId?: string | null; limit?: number },
) {
  const limit = options?.limit ?? 80;
  const conversationId = options?.conversationId;

  const where =
    conversationId === LEGACY_CONVERSATION_ID
      ? { administratorId, conversationId: null }
      : conversationId
        ? { administratorId, conversationId }
        : { administratorId };

  const rows = await prisma.adminAiMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, role: true, content: true, actionType: true, createdAt: true, conversationId: true },
  });

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: sanitizeAssistantMessageForDisplay(r.content),
    actionType: r.actionType,
    createdAt: r.createdAt.toISOString(),
    conversationId: r.conversationId,
  }));
}

export const ADMIN_ANTHROPIC_MODEL_OPTIONS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
] as const;

export async function runAdminAnalyticsAi(args: {
  action: AdminAiAction;
  administratorId: string;
  userMessage?: string;
  goalTitle?: string;
  overview: AdminPortalOverview;
  traffic: AdminTrafficSnapshot;
  history?: HistoryTurn[];
  modelOverride?: string;
}): Promise<string> {
  await hydratePlatformEnvFromDatabase();
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

  const vault = getAiVaultStatus();
  const context = buildContextSummary(args.overview, args.traffic, goals);

  if (!vault.configured) {
    return fallbackForAction(args.action, {
      goals,
      overview: args.overview,
      traffic: args.traffic,
      userMessage: args.userMessage,
      goalTitle: args.goalTitle,
    });
  }

  const systemPrompts: Record<AdminAiAction, string> = {
    set_goal:
      "You help a fitness marketplace operator define measurable KPI goals. Respond in clear, non-technical language. Confirm the goal in plain English and suggest a target metric (platform subscribers, unique visitors, client sign-ups, revenue, or premium trainers) with a realistic numeric target when possible. Never show raw JSON or code.",
    goal_analysis:
      "Analyze the operator's active goals against current platform metrics and site traffic. Be specific, actionable, and honest about gaps. Use bullet points. Reference real numbers from the context. Never show raw JSON or code.",
    site_analysis:
      "Analyze site traffic patterns for a fitness marketplace beta. Identify funnel leaks and recommend concrete CTA and copy tests. Use fitness-industry best practices. Write for a non-technical business owner. Never show raw JSON or code.",
    signup_recommendations:
      "Given traffic and conversion context, recommend 3–5 tactics to increase client and trainer sign-ups for an Atlanta beta launch. Use short headings and bullet points. Never show raw JSON or code.",
    freeform:
      "You are Match Fit's operator analytics copilot. Answer in clear, friendly business language using the live metrics context. Never dump raw JSON, field names, or code. If you cite numbers, round and label them plainly.",
  };

  const userContent =
    args.action === "set_goal" || args.action === "freeform"
      ? `${args.userMessage ?? ""}\n\nLive metrics (internal context — do not paste verbatim):\n${context}`
      : `Live metrics (internal context — do not paste verbatim):\n${context}\n\nTask: ${args.userMessage ?? args.action.replace(/_/g, " ")}`.trim();

  const priorTurns = (args.history ?? [])
    .filter((t) => t.content.trim().length > 0)
    .slice(-12)
    .map((t) => ({ role: t.role, content: t.content }));

  const modelOverride = args.modelOverride?.trim() || undefined;
  const ai = await callMatchFitAi({
    system: systemPrompts[args.action],
    user: userContent,
    priorTurns,
    modelOverride,
    maxTokens: 900,
    temperature: 0.4,
    kind: "chat",
    complexity: args.action === "freeform" ? "standard" : "simple",
  });

  return ai.text || fallbackForAction(args.action, {
    goals,
    overview: args.overview,
    traffic: args.traffic,
    userMessage: args.userMessage,
    goalTitle: args.goalTitle,
  });
}

export async function persistAdminAiTurn(args: {
  administratorId: string;
  conversationId?: string | null;
  role: "user" | "assistant";
  content: string;
  actionType?: AdminAiAction;
}): Promise<void> {
  await prisma.adminAiMessage.create({
    data: {
      administratorId: args.administratorId,
      conversationId: args.conversationId ?? null,
      role: args.role,
      content: args.content,
      actionType: args.actionType,
    },
  });

  if (args.conversationId) {
    await touchAdminAiConversation(args.conversationId);
  }
}
