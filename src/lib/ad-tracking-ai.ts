import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";

export type AdTrackingChatHistoryTurn = { role: "user" | "assistant"; content: string };

/** Minimal campaign-registry shape the copilot's context needs — matches the campaigns API response. */
export type AdTrackingChatCampaign = {
  campaignId: string;
  platform: string;
  name: string;
  venture: string;
  budgetCents: number | null;
  weekOf: string | null;
};

const SYSTEM_PROMPT = [
  "You are Match Fit's ads-analysis copilot, built into Ad Tracking HQ.",
  "You help a non-technical operator understand how their Meta, Google, and TikTok ad spend is performing.",
  "Answer in clear, friendly, plain-English business language — never dump raw JSON, field names, code, or SQL.",
  "When you cite a number, round it sensibly and say what it means in plain terms (for example, \"$42 spent on Meta, 3 people clicked through\").",
  "If the data shows no spend or no synced campaigns yet, say that plainly and suggest the one next step (register a campaign, or run Sync now) instead of guessing at numbers that are not there.",
  "Never invent spend, click, or conversion numbers that are not present in the context below.",
  "Keep answers short — a few sentences or a short bulleted list, not an essay.",
].join(" ");

function fallbackAdTrackingReply(panel: AdPerformancePanel, campaigns: AdTrackingChatCampaign[]): string {
  const anyConfigured = panel.integrations.some((i) => i.configured);
  if (!anyConfigured) {
    return [
      "The AI copilot is temporarily offline, so here's a quick read instead:",
      "No ad platform is connected yet (Meta, Google, and TikTok all show not configured). Once your developer adds the ad API credentials, this copilot can compare spend and clicks across platforms for you.",
    ].join("\n\n");
  }

  const totalSpendCents = panel.totals.meta.spendCents + panel.totals.google.spendCents + panel.totals.tiktok.spendCents;
  const totalClicks = panel.totals.meta.clicks + panel.totals.google.clicks + panel.totals.tiktok.clicks;
  const registered = campaigns.length;

  return [
    "The AI copilot is temporarily offline, so here's a quick read instead:",
    `Over the last ${panel.windowDays} days you spent about $${(totalSpendCents / 100).toFixed(2)} across connected platforms and got ${totalClicks} clicks.`,
    `You have ${registered} campaign${registered === 1 ? "" : "s"} registered.`,
    panel.attribution.length > 0
      ? "Your best on-site traffic source is listed in the On-Site Attribution table above."
      : "No on-site traffic is attributed to a campaign yet — make sure your ad links use the Campaign Link Builder above.",
  ].join("\n\n");
}

function buildAdTrackingContext(panel: AdPerformancePanel, campaigns: AdTrackingChatCampaign[]): string {
  return JSON.stringify(
    {
      windowDays: panel.windowDays,
      integrations: panel.integrations.map((i) => ({ platform: i.platform, configured: i.configured, spendSyncStatus: i.spendSyncStatus })),
      totals: panel.totals,
      campaignPerformance: panel.campaignPerformance,
      registeredCampaigns: campaigns.map((c) => ({
        campaignId: c.campaignId,
        platform: c.platform,
        name: c.name,
        venture: c.venture,
        budgetCents: c.budgetCents,
        weekOf: c.weekOf,
      })),
      onSiteAttribution: panel.attribution,
    },
    null,
    2,
  );
}

export async function runAdTrackingAi(args: {
  userMessage: string;
  panel: AdPerformancePanel;
  campaigns: AdTrackingChatCampaign[];
  history?: AdTrackingChatHistoryTurn[];
  modelOverride?: string;
}): Promise<string> {
  await hydratePlatformEnvFromDatabase();
  const vault = getAiVaultStatus();

  if (!vault.configured) {
    return fallbackAdTrackingReply(args.panel, args.campaigns);
  }

  const context = buildAdTrackingContext(args.panel, args.campaigns);
  const priorTurns = (args.history ?? [])
    .filter((t) => t.content.trim().length > 0)
    .slice(-12)
    .map((t) => ({ role: t.role, content: t.content }));

  const ai = await callMatchFitAi({
    system: SYSTEM_PROMPT,
    user: `${args.userMessage}\n\nLive ad tracking data (internal context — do not paste verbatim):\n${context}`,
    priorTurns,
    modelOverride: args.modelOverride,
    maxTokens: 700,
    temperature: 0.4,
    kind: "chat",
    complexity: "simple",
  });

  return ai.text || fallbackAdTrackingReply(args.panel, args.campaigns);
}
