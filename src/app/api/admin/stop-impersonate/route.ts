import { cookies } from "next/headers";
import { logAdministratorAuditEvent } from "@/lib/administrator-audit-log";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminImpersonationCookieOnNextResponse,
  getVerifiedAdminImpersonation,
  verifyAdminSessionToken,
} from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const imp = await getVerifiedAdminImpersonation();
    if (imp) {
      const username =
        imp.role === "client"
          ? (
              await prisma.client.findUnique({
                where: { id: imp.targetId },
                select: { username: true },
              })
            )?.username
          : (
              await prisma.trainer.findUnique({
                where: { id: imp.targetId },
                select: { username: true },
              })
            )?.username;
      void logAdministratorAuditEvent({
        administratorId: sess.adminId,
        action: "IMPERSONATION_END",
        targetRole: imp.role,
        targetId: imp.targetId,
        targetUsername: username ?? null,
        req,
      });
    }

    const res = NextResponse.json({ ok: true, next: "/admin" });
    clearAdminImpersonationCookieOnNextResponse(res);
    return res;
  } catch (e) {
    console.error("[admin stop-impersonate]", e);
    return NextResponse.json({ error: "Could not end impersonation." }, { status: 500 });
  }
}
