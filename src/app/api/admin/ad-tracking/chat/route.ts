import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdPerformancePanel } from "@/lib/ad-platform-performance";
import { runAdTrackingAi, type AdTrackingChatCampaign } from "@/lib/ad-tracking-ai";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional(),
  days: z.number().int().min(1).max(30).optional(),
});

async function loadCampaigns(): Promise<AdTrackingChatCampaign[]> {
  try {
    const rows = await prisma.adCampaignRegistry.findMany({
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return rows.map((r) => ({
      campaignId: r.campaignId,
      platform: r.platform,
      name: r.name,
      venture: r.venture,
      budgetCents: r.budgetCents,
      weekOf: r.weekOf,
    }));
  } catch (e) {
    if (isPrismaMissingTableError(e, "ad_campaign_registry")) return [];
    throw e;
  }
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await hydratePlatformEnvFromDatabase();

  try {
    const [panel, campaigns] = await Promise.all([
      getAdPerformancePanel(parsed.data.days ?? 7),
      loadCampaigns(),
    ]);

    const reply = await runAdTrackingAi({
      userMessage: parsed.data.message,
      panel,
      campaigns,
      history: parsed.data.history,
    });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[ad-tracking chat POST]", e);
    return NextResponse.json({ error: "Could not reach the ads copilot." }, { status: 500 });
  }
}
