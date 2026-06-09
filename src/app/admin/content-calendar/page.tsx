import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContentCalendarAiStatus } from "@/lib/content-calendar/content-calendar-ai";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { ContentCalendarClient } from "./content-calendar-client";

export default async function AdminContentCalendarPage() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  await hydratePlatformEnvFromDatabase();
  const aiStatus = getContentCalendarAiStatus();

  return <ContentCalendarClient aiStatus={aiStatus} />;
}
