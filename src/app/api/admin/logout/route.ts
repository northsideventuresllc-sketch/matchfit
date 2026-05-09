import {
  clearAdminSessionCookiesOnNextResponse,
  CLIENT_SESSION_COOKIE,
  LOGIN_CHALLENGE_COOKIE,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  TRAINER_SESSION_COOKIE,
} from "@/lib/session";
import { NextResponse } from "next/server";

/** Ends administrator session and clears impersonation; optionally clears client/trainer sessions when ending support. */
export async function POST(req: Request) {
  let clearEndUserSessions = false;
  try {
    const body = (await req.json().catch(() => null)) as { clearEndUserSessions?: boolean } | null;
    clearEndUserSessions = Boolean(body?.clearEndUserSessions);
  } catch {
    clearEndUserSessions = false;
  }

  const res = NextResponse.json({ ok: true, next: "/admin/login" });
  await clearAdminSessionCookiesOnNextResponse(res);
  if (clearEndUserSessions) {
    res.cookies.delete(CLIENT_SESSION_COOKIE);
    res.cookies.delete(TRAINER_SESSION_COOKIE);
    res.cookies.delete(LOGIN_CHALLENGE_COOKIE);
    res.cookies.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);
  }
  return res;
}
