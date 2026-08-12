import { adminUpdateAccountIdentity } from "@/lib/admin-account-support";
import { getSessionAdminId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

function parseAccountType(raw: string): "client" | "trainer" | null {
  return raw === "client" || raw === "trainer" ? raw : null;
}

const bodySchema = z.object({
  email: z.string().trim().email().optional(),
  username: z.string().trim().min(3).optional(),
});

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
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and/or username." }, { status: 400 });
  }
  const result = await adminUpdateAccountIdentity(accountType, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
