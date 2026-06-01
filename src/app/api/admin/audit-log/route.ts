import { NextResponse } from "next/server";
import { getAdminAuditLog } from "@/lib/admin-portal-data";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const items = await getAdminAuditLog(50);
  return NextResponse.json({ items });
}
