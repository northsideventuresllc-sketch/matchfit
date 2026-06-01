import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMIN_DASHBOARD_WIDGETS,
  parseAdminDashboardPreferences,
  serializeAdminDashboardPreferences,
  type AdminDashboardPreferencesPayload,
} from "@/lib/admin-dashboard-widgets";

export async function getAdminDashboardPreferences(
  administratorId: string,
): Promise<AdminDashboardPreferencesPayload> {
  const row = await prisma.adminDashboardPreferences.findUnique({
    where: { administratorId },
    select: { widgetsJson: true },
  });
  return parseAdminDashboardPreferences(row?.widgetsJson);
}

export async function saveAdminDashboardPreferences(
  administratorId: string,
  prefs: AdminDashboardPreferencesPayload,
): Promise<AdminDashboardPreferencesPayload> {
  const widgetsJson = serializeAdminDashboardPreferences(prefs);
  await prisma.adminDashboardPreferences.upsert({
    where: { administratorId },
    create: { administratorId, widgetsJson },
    update: { widgetsJson },
  });
  return prefs;
}

export async function ensureAdminDashboardPreferences(administratorId: string): Promise<void> {
  const existing = await prisma.adminDashboardPreferences.findUnique({
    where: { administratorId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.adminDashboardPreferences.create({
    data: {
      administratorId,
      widgetsJson: serializeAdminDashboardPreferences({
        enabledWidgets: [...DEFAULT_ADMIN_DASHBOARD_WIDGETS],
      }),
    },
  });
}
