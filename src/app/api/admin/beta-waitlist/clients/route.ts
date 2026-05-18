import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const store = await cookies();
  const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
  if (!sess) return null;
  const ok = await prisma.administrator.findUnique({ where: { id: sess.adminId }, select: { id: true } });
  return ok ? sess : null;
}

export async function GET() {
  const sess = await requireAdmin();
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await prisma.betaClientWaitlistEntry.findMany({
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      status: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      desiredUsername: true,
      homeZipCode: true,
      invitedAt: true,
      slotExpiresAt: true,
      registeredClientId: true,
    },
  });
  return NextResponse.json({ entries: rows });
}
