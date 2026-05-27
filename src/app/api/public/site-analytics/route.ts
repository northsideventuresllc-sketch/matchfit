import {
  isSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody,
  recordSiteAnalyticsEvent,
} from "@/lib/site-analytics";
import { getRequestClientIp } from "@/lib/request-client-ip";
import { simpleRateLimitAllow } from "@/lib/simple-rate-limit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const ip = getRequestClientIp(req);
    if (!simpleRateLimitAllow(`site-analytics:${ip}`, 180, 15 * 60 * 1000)) {
      return new NextResponse(null, { status: 429 });
    }

    if (isSiteAnalyticsBotUserAgent(req.headers.get("user-agent"))) {
      return new NextResponse(null, { status: 204 });
    }

    const body = await req.json().catch(() => null);
    const payload = parseSiteAnalyticsIngestBody(body);
    if (!payload) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    await recordSiteAnalyticsEvent(payload);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[site-analytics]", e);
    return new NextResponse(null, { status: 500 });
  }
}
