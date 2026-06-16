import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { EmailTemplatesClient } from "./email-templates-client";

export default async function AdminEmailTemplatesPage() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">Loading…</div>}>
      <EmailTemplatesClient />
    </Suspense>
  );
}
