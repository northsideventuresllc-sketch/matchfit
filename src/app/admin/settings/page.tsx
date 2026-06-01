import { redirect } from "next/navigation";
import { getAdminDashboardPreferences, ensureAdminDashboardPreferences } from "@/lib/admin-dashboard-preferences";
import { requireAdminSession } from "@/lib/require-admin";
import { AdminSettingsClient } from "./admin-settings-client";

export default async function AdminSettingsPage() {
  const sess = await requireAdminSession();
  if (!sess) redirect("/admin/login");
  await ensureAdminDashboardPreferences(sess.adminId);
  const prefs = await getAdminDashboardPreferences(sess.adminId);
  return <AdminSettingsClient initialEnabled={prefs.enabledWidgets} />;
}
