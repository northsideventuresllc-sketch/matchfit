import { NextResponse } from "next/server";
import { scanAndRecordWebsiteContext } from "@/lib/content-calendar/website-scan";
import { scanAndRecordSocialProfiles } from "@/lib/content-calendar/social-profile-scan";
import { analyzeSocialPerformance } from "@/lib/content-calendar/content-calendar-ai";
import { resetContentContextCache } from "@/lib/content-calendar/content-context";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await hydratePlatformEnvFromDatabase();
    resetContentContextCache();

    const body = (await req.json().catch(() => ({}))) as { includeAnalysis?: boolean };
    const [website, social] = await Promise.all([
      scanAndRecordWebsiteContext(),
      scanAndRecordSocialProfiles(),
    ]);

    let summary: string | undefined;
    if (body.includeAnalysis !== false) {
      summary = await analyzeSocialPerformance(true);
    }

    return NextResponse.json({
      website: { scannedAt: website.scannedAt, summary: website.summary },
      social: { scannedAt: social.scannedAt, summary: social.summary },
      summary,
    });
  } catch (e) {
    console.error("[content-calendar social-scan]", e);
    return NextResponse.json({ error: "Social scan failed." }, { status: 500 });
  }
}
