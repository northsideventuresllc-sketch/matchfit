import { cookies } from "next/headers";
import {
  type AdminDashboardLayout,
  parseAdminDashboardLayout,
} from "@/lib/admin-dashboard-layout";
import { loadAdminDashboardLayout, saveAdminDashboardLayout } from "@/lib/admin-dashboard-layout-server";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  layout: z.unknown(),
});

export async function GET() {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = token ? await verifyAdminSessionToken(token) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const exists = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const layout = await loadAdminDashboardLayout(sess.adminId);
    return NextResponse.json({ layout, persisted: layout !== null });
  } catch (e) {
    console.error("[admin dashboard-layout GET]", e);
    return NextResponse.json({ error: "Could not load layout." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = token ? await verifyAdminSessionToken(token) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const exists = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const layout: AdminDashboardLayout = parseAdminDashboardLayout(parsed.data.layout);
    const result = await saveAdminDashboardLayout(sess.adminId, layout);
    if (!result.ok) {
      return NextResponse.json({
        ok: true,
        layout,
        persisted: false,
        warning:
          "Layout saved in this browser only. Run database migrations to sync across devices.",
      });
    }

    return NextResponse.json({ ok: true, layout, persisted: true });
  } catch (e) {
    console.error("[admin dashboard-layout PUT]", e);
    return NextResponse.json({ error: "Could not save layout." }, { status: 500 });
  }
}
