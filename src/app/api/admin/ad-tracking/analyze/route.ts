import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(2000),
  windowDays: z.number().int().min(1).max(30),
  panel: z.custom<AdPerformancePanel>((v) => typeof v === "object" && v !== null),
  campaigns: z.array(
    z.object({
      campaignId: z.string(),
      platform: z.string(),
      name: z.string(),
      budgetCents: z.number().nullable(),
      weekOf: z.string().nullable(),
    }),
  ),
  priorTurns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(12)
    .optional(),
});

const SYSTEM_PROMPT =
  "You are Match Fit's ad-tracking copilot. The operator is not technical — answer in plain English, " +
  "short paragraphs or bullet points, no jargon (avoid acronyms like CAPI/GA4/UTM unless the operator used " +
  "them first), and no raw JSON. You are given live ad spend, clicks, conversions, and on-site attribution " +
  "for the last N days, plus the campaigns the operator has registered. Ground every answer in the numbers " +
  "given — never invent spend, clicks, or campaign names that are not in the data. If the data can't answer " +
  "the question, say so plainly and suggest what to check instead.";

function fallbackAnswer(panel: AdPerformancePanel): string {
  const spendLine = (["meta", "google", "tiktok"] as const)
    .map((p) => `${p[0].toUpperCase()}${p.slice(1)}: $${(panel.totals[p].spendCents / 100).toFixed(2)} spent, ${panel.totals[p].clicks} clicks`)
    .join(" · ");
  const topAttribution = panel.attribution
    .slice()
    .sort((a, b) => b.pageViews - a.pageViews)[0];
  return [
    "The AI copilot is offline right now, so here's the raw picture instead:",
    spendLine,
    topAttribution
      ? `Your best-performing tracked campaign by page views is "${topAttribution.utmCampaign}" (${topAttribution.pageViews} views, ${topAttribution.uniqueVisitors} visitors, ${topAttribution.signupPageViews} signup views).`
      : "No on-site attribution data yet — traffic from your tracking links will show up here once ads are live.",
  ].join("\n\n");
}

function buildContext(
  panel: AdPerformancePanel,
  campaigns: z.infer<typeof bodySchema>["campaigns"],
  windowDays: number,
): string {
  return JSON.stringify(
    {
      windowDays,
      spendByPlatform: panel.totals,
      attribution: panel.attribution,
      registeredCampaigns: campaigns,
    },
    null,
    2,
  );
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { question, windowDays, panel, campaigns, priorTurns } = parsed.data;

  await hydratePlatformEnvFromDatabase();
  const vault = getAiVaultStatus();
  if (!vault.configured) {
    return NextResponse.json({ answer: fallbackAnswer(panel), usedFallback: true });
  }

  const context = buildContext(panel, campaigns, windowDays);
  const ai = await callMatchFitAi({
    system: SYSTEM_PROMPT,
    user: `Live ad data (last ${windowDays} days, internal — do not paste verbatim):\n${context}\n\nQuestion: ${question}`,
    priorTurns,
    maxTokens: 700,
    temperature: 0.4,
    kind: "chat",
    complexity: "simple",
  });

  if (!ai.text) {
    return NextResponse.json({ answer: fallbackAnswer(panel), usedFallback: true });
  }
  return NextResponse.json({ answer: ai.text, usedFallback: false, provider: ai.provider });
}
