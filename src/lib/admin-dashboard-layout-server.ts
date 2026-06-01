import "server-only";

import {
  type AdminDashboardLayout,
  parseAdminDashboardLayout,
  serializeAdminDashboardLayout,
} from "@/lib/admin-dashboard-layout";
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column";
import { prisma } from "@/lib/prisma";

export async function loadAdminDashboardLayout(administratorId: string): Promise<AdminDashboardLayout | null> {
  try {
    const row = await prisma.administrator.findUnique({
      where: { id: administratorId },
      select: { adminDashboardLayoutJson: true },
    });
    if (!row?.adminDashboardLayoutJson) return null;
    return parseAdminDashboardLayout(JSON.parse(row.adminDashboardLayoutJson));
  } catch (e) {
    if (isPrismaMissingColumnError(e, "adminDashboardLayoutJson")) return null;
    throw e;
  }
}

export async function saveAdminDashboardLayout(
  administratorId: string,
  layout: AdminDashboardLayout,
): Promise<{ ok: true } | { ok: false; reason: "missing_column" }> {
  try {
    await prisma.administrator.update({
      where: { id: administratorId },
      data: { adminDashboardLayoutJson: serializeAdminDashboardLayout(layout) },
    });
    return { ok: true };
  } catch (e) {
    if (isPrismaMissingColumnError(e, "adminDashboardLayoutJson")) {
      return { ok: false, reason: "missing_column" };
    }
    throw e;
  }
}
