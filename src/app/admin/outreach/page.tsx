import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { OutreachHqRetiredNotice } from "./outreach-hq-client";

/**
 * Outreach HQ v1 — retired. Outreach HQ now means v2 only (see AdminPortalNav's "outreach" entry
 * and /admin/outreach/v2). This route and outreach-hq-client.tsx stay in place, unlinked from the
 * main nav, so the archive-tools page (separate build) has a stable place to point at.
 */
export default async function AdminOutreachPage() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  return <OutreachHqRetiredNotice />;
}
