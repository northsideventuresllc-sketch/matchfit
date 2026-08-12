import { lockAccountForSecurity, verifyWasntMeToken } from "@/lib/account-security-lock";
import { clearAdminSession, getSessionAdminId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This link is missing its token." }, { status: 400 });
  }

  const claims = await verifyWasntMeToken(parsed.data.token);
  if (!claims || claims.accountType !== "admin") {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  await lockAccountForSecurity("admin", claims.accountId);

  const activeAdminId = await getSessionAdminId();
  if (activeAdminId === claims.accountId) {
    await clearAdminSession();
  }

  return NextResponse.json({ ok: true });
}
