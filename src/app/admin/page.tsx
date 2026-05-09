import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  const [clientCount, trainerCount] = await Promise.all([
    prisma.client.count({ where: { deidentifiedAt: null } }),
    prisma.trainer.count({ where: { deidentifiedAt: null } }),
  ]);

  return (
    <AdminDashboardClient initialStats={{ clientCount, trainerCount }} initialTestMode={sess.testMode} />
  );
}
