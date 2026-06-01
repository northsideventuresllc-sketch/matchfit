import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_ADMIN_DASHBOARD_LAYOUT } from "@/lib/admin-dashboard-layout";
import { loadAdminDashboardLayout } from "@/lib/admin-dashboard-layout-server";
import { getAdminPortalOverview, type AdminPortalOverview } from "@/lib/admin-portal-data";
import { prisma } from "@/lib/prisma";
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

  let overview: AdminPortalOverview | null = null;
  let loadError: string | null = null;

  try {
    overview = await getAdminPortalOverview();
  } catch (e) {
    console.error("[admin home]", e);
    const message = e instanceof Error ? e.message : "";
    const missingReportingTable =
      message.includes("platform_revenue_events") ||
      message.includes("administrator_audit_logs") ||
      message.includes("site_analytics_events");
    loadError = missingReportingTable
      ? "Administrator reporting tables could not be initialized. From the project root run `npm run db:migrate` (production) or `npm run db:push` (local), then reload. If this persists, check server logs for database permissions."
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

  const savedLayout = await loadAdminDashboardLayout(sess.adminId);

  return (
    <AdminDashboardClient
      initialOverview={overview}
      initialTestMode={sess.testMode}
      initialLayout={savedLayout ?? DEFAULT_ADMIN_DASHBOARD_LAYOUT}
      administratorId={sess.adminId}
      layoutLoadedFromServer={savedLayout !== null}
    />
  );
}
