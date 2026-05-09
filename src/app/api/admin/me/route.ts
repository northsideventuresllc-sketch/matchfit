import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_IMPERSONATION_COOKIE,
  ADMIN_SESSION_COOKIE,
  verifyAdminImpersonationToken,
  verifyAdminSessionToken,
} from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    if (!adminTok) {
      return NextResponse.json({ admin: null });
    }
    const sess = await verifyAdminSessionToken(adminTok);
    if (!sess) {
      return NextResponse.json({ admin: null });
    }

    const row = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: {
        id: true,
        adminCode: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!row) {
      return NextResponse.json({ admin: null });
    }

    let impersonation: {
      role: "client" | "trainer";
      targetId: string;
      username: string | null;
    } | null = null;

    const impTok = store.get(ADMIN_IMPERSONATION_COOKIE)?.value;
    if (impTok) {
      const imp = await verifyAdminImpersonationToken(impTok);
      if (imp && imp.adminId === sess.adminId) {
        if (imp.role === "client") {
          const c = await prisma.client.findUnique({
            where: { id: imp.targetId },
            select: { username: true, deidentifiedAt: true },
          });
          if (c && !c.deidentifiedAt) {
            impersonation = { role: "client", targetId: imp.targetId, username: c.username };
          }
        } else {
          const t = await prisma.trainer.findUnique({
            where: { id: imp.targetId },
            select: { username: true, deidentifiedAt: true },
          });
          if (t && !t.deidentifiedAt) {
            impersonation = { role: "trainer", targetId: imp.targetId, username: t.username };
          }
        }
      }
    }

    return NextResponse.json({
      admin: {
        ...row,
        testMode: sess.testMode,
        rememberMe: sess.rememberMe,
      },
      impersonation,
    });
  } catch (e) {
    console.error("[admin me]", e);
    return NextResponse.json({ error: "Could not load session." }, { status: 500 });
  }
}
