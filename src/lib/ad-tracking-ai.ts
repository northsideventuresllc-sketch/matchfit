import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { getAdPerformancePanel, type AdPerformancePanel } from "@/lib/ad-platform-performance";

type RegisteredCampaignSummary = {
  campaignId: string;
  platform: string;
  name: string;
  venture: string;
  budgetCents: number | null;
  weekOf: string | null;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function loadRegisteredCampaigns(): Promise<RegisteredCampaignSummary[]> {
  try {
    return await prisma.adCampaignRegistry.findMany({
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: { campaignId: true, platform: true, name: true, venture: true, budgetCents: true, weekOf: true },
    });
  } catch (e) {
    if (isPrismaMissingTableError(e, "ad_campaign_registry")) return [];
    throw e;
  }
}

function buildAdContextSummary(panel: AdPerformancePanel, campaigns: RegisteredCampaignSummary[]): string {
  return JSON.stringify(
    {
      windowDays: panel.windowDays,
      spend: {
        meta: panel.totals.meta,
        google: panel.totals.google,
        tiktok: panel.totals.tiktok,
      },
      onSiteAttribution: {
        attributedPageViews: panel.totals.attributedPageViews,
        attributedSignupViews: panel.totals.attributedSignupViews,
        topRows: panel.attribution.slice(0, 10),
      },
      integrations: panel.integrations.map((i) => ({
        platform: i.platform,
        configured: i.configured,
        spendSyncStatus: i.spendSyncStatus ?? (i.configured ? "credentials_present" : "not_configured"),
      })),
      registeredCampaigns: campaigns,
    },
    null,
    2,
  );
}

/** Deterministic, honest summary used when no AI provider is configured — never fabricates a number. */
function fallbackAdAnalysisReply(panel: AdPerformancePanel, campaigns: RegisteredCampaignSummary[]): string {
  const totalSpendCents = panel.totals.meta.spendCents + panel.totals.google.spendCents + panel.totals.tiktok.spendCents;
  const lines = [
    `Over the last ${panel.windowDays} days: Meta ${formatUsd(panel.totals.meta.spendCents)} spent / ${panel.totals.meta.clicks} clicks, Google ${formatUsd(panel.totals.google.spendCents)} / ${panel.totals.google.clicks} clicks, TikTok ${formatUsd(panel.totals.tiktok.spendCents)} / ${panel.totals.tiktok.clicks} clicks.`,
    `Total tracked spend: ${formatUsd(totalSpendCents)}. Attributed site visits: ${panel.totals.attributedPageViews.toLocaleString()}, signup page views: ${panel.totals.attributedSignupViews.toLocaleString()}.`,
    campaigns.length > 0
      ? `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} registered — most recent: ${campaigns[0]?.name}.`
      : "No campaigns registered yet — use Campaign Registry below to log one.",
    "This is a built-in numbers summary. Connect an AI Vault provider for deeper recommendations.",
  ];
  return lines.join("\n\n");
}

export async function runAdTrackingAi(args: {
  message: string;
  priorTurns?: { role: "user" | "assistant"; content: string }[];
  modelOverride?: string;
}): Promise<string> {
  await hydratePlatformEnvFromDatabase();

  const [panel, campaigns] = await Promise.all([getAdPerformancePanel(7), loadRegisteredCampaigns()]);
  const vault = getAiVaultStatus();

  if (!vault.configured) {
    return fallbackAdAnalysisReply(panel, campaigns);
  }

  const context = buildAdContextSummary(panel, campaigns);
  const system =
    "You are Match Fit's ad performance copilot for the operator. Analyze ad spend, clicks, conversions, on-site attribution, and the registered campaign list to answer the operator's question about their ad campaigns. Be specific and actionable — recommend concrete next steps (which platform to shift budget toward, which campaign to pause, what to test next). Never show raw JSON, internal field names, table names, or code — round and label every number plainly. Never invent a number that is not present in the data provided; say plainly when data is missing instead of guessing.";
  const user = `${args.message}\n\nLive ad tracking data (internal context — do not paste verbatim):\n${context}`;

  const ai = await callMatchFitAi({
    system,
    user,
    priorTurns: (args.priorTurns ?? []).slice(-12),
    modelOverride: args.modelOverride,
    maxTokens: 900,
    temperature: 0.4,
    kind: "chat",
    complexity: "simple",
  });

  return ai.text || fallbackAdAnalysisReply(panel, campaigns);
}
