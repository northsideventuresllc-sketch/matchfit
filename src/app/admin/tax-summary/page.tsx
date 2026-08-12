import { redirect } from "next/navigation";
import { getSessionAdminId } from "@/lib/session";
import { AdminTaxSummaryClient } from "./admin-tax-summary-client";

export default async function AdminTaxSummaryPage() {
  const adminId = await getSessionAdminId();
  if (!adminId) redirect("/admin/login");

  return <AdminTaxSummaryClient />;
}
