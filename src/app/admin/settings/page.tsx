import { redirect } from "next/navigation";
import { DEFAULT_ADMIN_DASHBOARD_LAYOUT } from "@/lib/admin-dashboard-layout";
import { loadAdminDashboardLayout } from "@/lib/admin-dashboard-layout-server";
import { requireAdminSession } from "@/lib/require-admin";
import { AdminSettingsClient } from "./admin-settings-client";

export default async function AdminSettingsPage() {
  const sess = await requireAdminSession();
  if (!sess) redirect("/admin/login");

  const savedLayout = await loadAdminDashboardLayout(sess.adminId);

  return (
    <AdminSettingsClient
      administratorId={sess.adminId}
      initialLayout={savedLayout ?? DEFAULT_ADMIN_DASHBOARD_LAYOUT}
      layoutLoadedFromServer={savedLayout !== null}
    />
  );
}
