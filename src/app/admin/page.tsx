import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_ADMIN_DASHBOARD_LAYOUT } from "@/lib/admin-dashboard-layout";
import { loadAdminDashboardLayout } from "@/lib/admin-dashboard-layout-server";
import { getAdminAuditLog, getAdminPortalOverview, type AdminPortalOverview } from "@/lib/admin-portal-data";
import {
  ensureAdminPortalSchema,
  isAdminPortalConnectionError,
  isAdminPortalSchemaError,
} from "@/lib/ensure-admin-portal-schema";
import { isMissingClientPlanColumnError } from "@/lib/ensure-client-plan-schema";
import { isMissingClientPlatformTrialColumnError } from "@/lib/ensure-client-platform-trial-schema";
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
    select: { id: true, securityLockedAt: true },
  });
  if (!adminRow) {
    redirect("/admin/login");
  }
  if (adminRow.securityLockedAt) {
    redirect("/admin/account-locked");
  }

  let overview: AdminPortalOverview | null = null;
  let loadError: string | null = null;
  let auditLog: Awaited<ReturnType<typeof getAdminAuditLog>> = [];

  try {
    await ensureAdminPortalSchema();
    overview = await getAdminPortalOverview();
    auditLog = await getAdminAuditLog(25);
  } catch (e) {
    console.error("[admin home]", e);
    const message = e instanceof Error ? e.message : "";
    const missingReportingTable =
      message.includes("platform_revenue_events") ||
      message.includes("administrator_audit_logs") ||
      message.includes("site_analytics_events") ||
      message.includes("admin_goals") ||
      message.includes("admin_ai_messages");
    loadError = missingReportingTable
      ? "Administrator reporting tables could not be initialized. From the project root run `npm run db:migrate` (production) or `npm run db:push` (local), then reload. If this persists, check server logs for database permissions."
      : isAdminPortalConnectionError(e)
        ? "Could not reach the production database from Vercel. Confirm DATABASE_URL uses the Supabase transaction pooler (port 6543) and redeploy."
        : isMissingClientPlanColumnError(e) || isMissingClientPlatformTrialColumnError(e)
          ? "Client plan columns need a one-time schema repair. Reload this page — the app will retry automatically. If this persists, confirm DIRECT_URL is set on the server and run `npm run db:migrate`."
          : isAdminPortalSchemaError(e)
            ? "Administrator database permissions need repair. Reload once — the app will retry schema repair automatically."
            : "Could not load the administrator dashboard. Check database connectivity and server logs.";
  }

  if (loadError) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 p-6">
          <h1 className="text-lg font-black">Administrator Portal unavailable</h1>
          <p className="mt-3 text-sm text-[#FFB4B4]">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">
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
      auditLog={auditLog}
    />
  );
}
