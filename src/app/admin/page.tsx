import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureAdminDashboardPreferences,
  getAdminDashboardPreferences,
} from "@/lib/admin-dashboard-preferences";
import { getAdminAuditLog, getAdminPortalOverview, type AdminPortalOverview } from "@/lib/admin-portal-data";
import { runAdminAnalyticsAi } from "@/lib/admin-analytics-ai";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";
import { getAdminSiteTrafficSnapshot } from "@/lib/site-analytics";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default async function AdminHomePage() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) {
    redirect("/admin/login");
  }

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) {
    redirect("/admin/login");
  }

  await ensureAdminDashboardPreferences(sess.adminId);
  const preferences = await getAdminDashboardPreferences(sess.adminId);

  let overview: AdminPortalOverview | null = null;
  let loadError: string | null = null;
  let visitorInsight = "";
  let auditLog: Awaited<ReturnType<typeof getAdminAuditLog>> = [];

  try {
    overview = await getAdminPortalOverview();
    auditLog = await getAdminAuditLog(25);
    if (preferences.enabledWidgets.includes("ai_visitor_insights")) {
      visitorInsight = await runAdminAnalyticsAi({
        action: "signup_recommendations",
        administratorId: sess.adminId,
        overview,
        traffic: overview.traffic,
      });
    }
  } catch (e) {
    console.error("[admin home]", e);
    const message = e instanceof Error ? e.message : "";
    loadError =
      message.includes("platform_revenue_events") || message.includes("site_analytics_events")
        ? "Administrator reporting tables are missing. Run `npm run db:push` (or apply the latest migration) and reload."
        : "Could not load the administrator dashboard. Check database connectivity and server logs.";
  }

  if (loadError) {
    return (
      <main className="min-h-dvh bg-[#050608] px-5 py-16 text-white">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 p-6">
          <h1 className="text-lg font-black">Administrator Portal unavailable</h1>
          <p className="mt-3 text-sm text-[#FFB4B4]">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-dvh bg-[#050608] px-5 py-16 text-white">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 p-6">
          <h1 className="text-lg font-black">Administrator Portal unavailable</h1>
          <p className="mt-3 text-sm text-[#FFB4B4]">Could not load dashboard data.</p>
        </div>
      </main>
    );
  }

  return (
    <AdminDashboardClient
      initialOverview={overview}
      initialTestMode={sess.testMode}
      enabledWidgets={preferences.enabledWidgets}
      auditLog={auditLog}
      visitorInsight={visitorInsight}
    />
  );
}
