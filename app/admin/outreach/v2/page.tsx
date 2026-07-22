import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { probeAdminAiProvider } from "@/lib/admin-analytics-ai";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { OutreachHqV2Client } from "./outreach-hq-v2-client";

export default async function AdminOutreachHqV2Page() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  const aiStatus = await probeAdminAiProvider();

  return <OutreachHqV2Client aiStatus={aiStatus} />;
}
