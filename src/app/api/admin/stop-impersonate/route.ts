import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminImpersonationCookieOnNextResponse,
  verifyAdminSessionToken,
} from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, next: "/admin" });
    clearAdminImpersonationCookieOnNextResponse(res);
    return res;
  } catch (e) {
    console.error("[admin stop-impersonate]", e);
    return NextResponse.json({ error: "Could not end impersonation." }, { status: 500 });
  }
}
