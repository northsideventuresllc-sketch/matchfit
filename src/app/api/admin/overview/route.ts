import { cookies } from "next/headers";
import { getAdminPortalDashboard } from "@/lib/admin-portal-data";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ok = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const dashboard = await getAdminPortalDashboard();
    return NextResponse.json(dashboard);
  } catch (e) {
    console.error("[admin overview]", e);
    return NextResponse.json({ error: "Could not load overview." }, { status: 500 });
  }
}
