import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAdminDashboardPreferences,
  saveAdminDashboardPreferences,
} from "@/lib/admin-dashboard-preferences";
import { ADMIN_DASHBOARD_WIDGETS, type AdminDashboardWidgetId } from "@/lib/admin-dashboard-widgets";
import { requireAdminSession } from "@/lib/require-admin";

const widgetIdSchema = z.enum(
  ADMIN_DASHBOARD_WIDGETS as unknown as [AdminDashboardWidgetId, ...AdminDashboardWidgetId[]],
);

const putSchema = z.object({
  enabledWidgets: z.array(widgetIdSchema).min(1),
});

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const prefs = await getAdminDashboardPreferences(sess.adminId);
  return NextResponse.json(prefs);
}

export async function PUT(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  }
  const saved = await saveAdminDashboardPreferences(sess.adminId, {
    enabledWidgets: parsed.data.enabledWidgets as AdminDashboardWidgetId[],
  });
  return NextResponse.json(saved);
}
