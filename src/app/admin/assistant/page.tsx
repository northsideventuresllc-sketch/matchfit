import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/require-admin";
import { AdminAssistantClient } from "./admin-assistant-client";

export default async function AdminAssistantPage() {
  const sess = await requireAdminSession();
  if (!sess) redirect("/admin/login");
  return <AdminAssistantClient />;
}
