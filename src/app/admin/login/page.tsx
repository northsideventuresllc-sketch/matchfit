import { redirect } from "next/navigation";
import { getSessionAdminId } from "@/lib/session";
import AdminLoginPortal from "./admin-login-portal";

export default async function AdminLoginPage() {
  const adminId = await getSessionAdminId();
  if (adminId) {
    redirect("/admin");
  }
  return <AdminLoginPortal />;
}
