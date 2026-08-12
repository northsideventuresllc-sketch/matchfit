import { searchAccountsForSupport } from "@/lib/admin-account-support";
import { getSessionAdminId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const adminId = await getSessionAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchAccountsForSupport(q);
  return NextResponse.json({ results });
}
