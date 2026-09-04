import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionAdminId } from "@/lib/session";
import { AdminAccountSupportClient } from "./admin-account-support-client";

export default async function AdminSupportToolsPage() {
  const adminId = await getSessionAdminId();
  if (!adminId) redirect("/admin/login");

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">Loading…</div>}>
      <AdminAccountSupportClient />
    </Suspense>
  );
}
