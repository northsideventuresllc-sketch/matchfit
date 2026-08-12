import { redirect } from "next/navigation";
import { getSessionAdminId } from "@/lib/session";
import { AdminAccountSupportClient } from "./admin-account-support-client";

export default async function AdminSupportToolsPage() {
  const adminId = await getSessionAdminId();
  if (!adminId) redirect("/admin/login");

  return <AdminAccountSupportClient />;
}
