import { NextResponse } from "next/server";
import { z } from "zod";
import { syncAdCampaignPerformance, syncAdPlatformPerformance } from "@/lib/ad-platform-performance";
import type { AdPlatform } from "@/lib/ad-tracking-config";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  days: z.number().int().min(1).max(30).optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await hydratePlatformEnvFromDatabase();

  let days = 7;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success && parsed.data.days) days = parsed.data.days;
  } catch {
    // Empty body is fine — default window.
  }

  try {
    const [accountResult, campaignResult] = await Promise.all([
      syncAdPlatformPerformance(days),
      syncAdCampaignPerformance(days),
    ]);
    const synced = Array.from(new Set([...accountResult.synced, ...campaignResult.synced])) as AdPlatform[];
    const errors = { ...accountResult.errors, ...campaignResult.errors };
    return NextResponse.json({ synced, errors });
  } catch (e) {
    console.error("[ad-tracking sync POST]", e);
    return NextResponse.json({ error: "Ad platform sync failed." }, { status: 500 });
  }
}
