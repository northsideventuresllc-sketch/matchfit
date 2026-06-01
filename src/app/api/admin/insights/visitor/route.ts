import { NextResponse } from "next/server";
import { getAdminPortalOverview } from "@/lib/admin-portal-data";
import { runAdminAnalyticsAi } from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";
import { getAdminSiteTrafficSnapshot } from "@/lib/site-analytics";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const [overview, traffic] = await Promise.all([
    getAdminPortalOverview(),
    getAdminSiteTrafficSnapshot(7),
  ]);
  const insight = await runAdminAnalyticsAi({
    action: "signup_recommendations",
    administratorId: sess.adminId,
    overview,
    traffic,
  });
  return NextResponse.json({ insight, traffic });
}
