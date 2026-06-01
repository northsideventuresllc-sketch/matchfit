import { NextResponse } from "next/server";
import { ensureAdminReportingSchema } from "@/lib/ensure-admin-reporting-schema";
import {
  isSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody,
} from "@/lib/site-analytics-shared";
import { recordSiteAnalyticsEvent } from "@/lib/site-analytics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (isSiteAnalyticsBotUserAgent(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }
  const body = await req.json().catch(() => null);
  const payload = parseSiteAnalyticsIngestBody(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  try {
    await ensureAdminReportingSchema();
    await recordSiteAnalyticsEvent(payload);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[site-analytics ingest]", e);
    return NextResponse.json({ ok: true, skipped: "storage" });
  }
}
