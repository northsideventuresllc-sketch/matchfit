import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { ContentCalendarV2Client } from "./content-calendar-v2-client";

export default async function AdminContentCalendarV2Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  const aiStatus = await getContentCalendarAiStatusAsync();
  const { tab } = await searchParams;

  return <ContentCalendarV2Client aiStatus={aiStatus} initialTab={tab} />;
}
