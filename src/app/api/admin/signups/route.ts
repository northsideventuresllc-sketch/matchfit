import { cookies } from "next/headers";
import { getAdminSignupLog } from "@/lib/admin-portal-data";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const { rows, total } = await getAdminSignupLog({ limit, offset });
    return NextResponse.json({ rows, total });
  } catch (e) {
    console.error("[admin signups]", e);
    return NextResponse.json({ error: "Could not load signup log." }, { status: 500 });
  }
}
