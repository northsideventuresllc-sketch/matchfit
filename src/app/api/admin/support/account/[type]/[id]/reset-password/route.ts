import { adminTriggerPasswordReset } from "@/lib/admin-account-support";
import { getSessionAdminId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseAccountType(raw: string): "client" | "trainer" | null {
  return raw === "client" || raw === "trainer" ? raw : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const adminId = await getSessionAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { type, id } = await params;
  const accountType = parseAccountType(type);
  if (!accountType) {
    return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
  }
  const result = await adminTriggerPasswordReset(accountType, id, req);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
