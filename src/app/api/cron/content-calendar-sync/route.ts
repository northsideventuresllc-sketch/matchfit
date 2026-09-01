import { NextResponse } from "next/server";
import { scanAndRecordWebsiteContext } from "@/lib/content-calendar/website-scan";
import { scanAndRecordSocialProfiles } from "@/lib/content-calendar/social-profile-scan";
import { resetContentContextCache } from "@/lib/content-calendar/content-context";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { estDateString } from "@/lib/content-calendar/schedule-utils";
import { findTodaysMissingPostTypes } from "@/lib/content-calendar/content-calendar-v2-store";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

async function runSync() {
  await hydratePlatformEnvFromDatabase();
  resetContentContextCache();
  const [website, social] = await Promise.all([
    scanAndRecordWebsiteContext(),
    scanAndRecordSocialProfiles(),
  ]);

  const today = estDateString();
  const missingToday = await findTodaysMissingPostTypes(today);
  if (missingToday.length > 0) {
    console.error(
      `[cron content-calendar-sync] TODAY'S FOUR-PACK IS INCOMPLETE (${today}): missing ${missingToday.join(", ")}`,
    );
  }

  return {
    website: { scannedAt: website.scannedAt, paths: website.pages.map((p) => p.path) },
    social: {
      scannedAt: social.scannedAt,
      platforms: social.profiles.map((p) => ({ platform: p.platform, status: p.status })),
    },
    today: { date: today, missingPostTypes: missingToday },
  };
}

/** Periodic website + social scan so content generation stays aligned with live promos and profiles. */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron content-calendar-sync]", e);
    return NextResponse.json({ error: "Content calendar sync failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
