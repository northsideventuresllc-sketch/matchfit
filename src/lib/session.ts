/**
 * Auth sessions use signed JWTs stored only in **httpOnly** cookies (`mf_client_session`, `mf_trainer_session`,
 * `mf_admin_session`) so scripts cannot read tokens; use `secure` in production.
 *
 * Staff may use `mf_admin_impersonation` together with `mf_admin_session` so server helpers resolve the impersonated
 * client/trainer id from {@link getSessionClientId} / {@link getSessionTrainerId} without storing their password.
 */
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeTrainerPostAuthPath, type TrainerPostAuthPath } from "@/lib/trainer-post-auth-redirect";

export const CLIENT_SESSION_COOKIE = "mf_client_session";
export const TRAINER_SESSION_COOKIE = "mf_trainer_session";
export const LOGIN_CHALLENGE_COOKIE = "mf_login_challenge";
export const TRAINER_LOGIN_CHALLENGE_COOKIE = "mf_trainer_login_challenge";
export const REGISTRATION_HOLD_COOKIE = "mf_registration_hold";
export const ADMIN_SESSION_COOKIE = "mf_admin_session";
export const ADMIN_IMPERSONATION_COOKIE = "mf_admin_impersonation";

const REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ADMIN_IMPERSONATION_MAX_AGE = 60 * 60 * 12;

/**
 * `Secure` cookies are not stored on plain http:// URLs. Set `MATCH_FIT_COOKIE_SECURE=0` when smoke-testing a production
 * build on http://localhost (never use that override on a real HTTPS deployment).
 */
function sessionCookieSecure(): boolean {
  const v = process.env.MATCH_FIT_COOKIE_SECURE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return process.env.NODE_ENV === "production";
}

export function getAuthSecretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) {
    return new TextEncoder().encode(s);
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[Match Fit] AUTH_SECRET is missing or short; using a development default. Set AUTH_SECRET (32+ chars) in .env for production-like behavior.",
    );
    return new TextEncoder().encode("dev-only-auth-secret-32chars-min!!");
  }
  throw new Error("AUTH_SECRET must be set to at least 32 characters.");
}

export async function signSessionToken(clientId: string, rememberMe: boolean): Promise<string> {
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuedAt();
  if (rememberMe) {
    jwt.setExpirationTime("30d");
  } else {
    jwt.setExpirationTime("12h");
  }
  return jwt.sign(getAuthSecretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t != null) {
      return null;
    }
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function setClientSession(clientId: string, rememberMe: boolean): Promise<void> {
  const token = await signSessionToken(clientId, rememberMe);
  const store = await cookies();
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
  };
  if (rememberMe) {
    store.set(CLIENT_SESSION_COOKIE, token, { ...base, maxAge: REMEMBER_COOKIE_MAX_AGE });
  } else {
    store.set(CLIENT_SESSION_COOKIE, token, base);
  }
}

export async function clearClientSession(): Promise<void> {
  const store = await cookies();
  store.delete(CLIENT_SESSION_COOKIE);
}

export async function getSessionClientId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(CLIENT_SESSION_COOKIE)?.value;
  if (token) {
    const id = await verifySessionToken(token);
    if (id) return id;
  }
  const imp = await getVerifiedAdminImpersonationFromCookies(store);
  if (imp?.role === "client") return imp.targetId;
  return null;
}

export async function setTrainerSession(trainerId: string, rememberMe: boolean): Promise<void> {
  const token = await signSessionToken(trainerId, rememberMe);
  const store = await cookies();
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
  };
  if (rememberMe) {
    store.set(TRAINER_SESSION_COOKIE, token, { ...base, maxAge: REMEMBER_COOKIE_MAX_AGE });
  } else {
    store.set(TRAINER_SESSION_COOKIE, token, base);
  }
}

/** Prefer this from Route Handlers so the session cookie is definitely attached to the returned `NextResponse`. */
export async function applyTrainerSessionToNextResponse(
  res: NextResponse,
  trainerId: string,
  rememberMe: boolean,
): Promise<void> {
  const token = await signSessionToken(trainerId, rememberMe);
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
  };
  if (rememberMe) {
    res.cookies.set(TRAINER_SESSION_COOKIE, token, { ...base, maxAge: REMEMBER_COOKIE_MAX_AGE });
  } else {
    res.cookies.set(TRAINER_SESSION_COOKIE, token, base);
  }
}

/** Prefer this from Route Handlers so the session cookie is definitely attached to the returned `NextResponse`. */
export async function applyClientSessionToNextResponse(
  res: NextResponse,
  clientId: string,
  rememberMe: boolean,
): Promise<void> {
  const token = await signSessionToken(clientId, rememberMe);
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
  };
  if (rememberMe) {
    res.cookies.set(CLIENT_SESSION_COOKIE, token, { ...base, maxAge: REMEMBER_COOKIE_MAX_AGE });
  } else {
    res.cookies.set(CLIENT_SESSION_COOKIE, token, base);
  }
}

export function applyTrainerLoginChallengeToNextResponse(res: NextResponse, token: string): void {
  res.cookies.set(TRAINER_LOGIN_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearTrainerSession(): Promise<void> {
  const store = await cookies();
  store.delete(TRAINER_SESSION_COOKIE);
}

export async function getSessionTrainerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(TRAINER_SESSION_COOKIE)?.value;
  if (token) {
    const id = await verifySessionToken(token);
    if (id) return id;
  }
  const imp = await getVerifiedAdminImpersonationFromCookies(store);
  if (imp?.role === "trainer") return imp.targetId;
  return null;
}

export type AdminImpersonationContext = {
  adminId: string;
  role: "client" | "trainer";
  targetId: string;
  testMode: boolean;
};

async function getVerifiedAdminImpersonationFromCookies(
  store: Awaited<ReturnType<typeof cookies>>,
): Promise<AdminImpersonationContext | null> {
  const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const impTok = store.get(ADMIN_IMPERSONATION_COOKIE)?.value;
  if (!adminTok || !impTok) return null;
  const admin = await verifyAdminSessionToken(adminTok);
  if (!admin) return null;
  const imp = await verifyAdminImpersonationToken(impTok);
  if (!imp || imp.adminId !== admin.adminId) return null;
  return { adminId: imp.adminId, role: imp.role, targetId: imp.targetId, testMode: admin.testMode };
}

/** Valid admin session + impersonation cookie pair (for support UI and guarded APIs). */
export async function getVerifiedAdminImpersonation(): Promise<AdminImpersonationContext | null> {
  const store = await cookies();
  return getVerifiedAdminImpersonationFromCookies(store);
}

export async function getSessionAdminId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const v = await verifyAdminSessionToken(token);
  return v?.adminId ?? null;
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<{ adminId: string; testMode: boolean; rememberMe: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_admin") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { adminId: sub, testMode: payload.tm === 1, rememberMe: payload.rm !== 0 };
  } catch {
    return null;
  }
}

export async function signAdminSessionToken(
  adminId: string,
  rememberMe: boolean,
  testMode: boolean,
): Promise<string> {
  const jwt = new SignJWT({ t: "mf_admin", tm: testMode ? 1 : 0, rm: rememberMe ? 1 : 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt();
  if (rememberMe) {
    jwt.setExpirationTime("30d");
  } else {
    jwt.setExpirationTime("12h");
  }
  return jwt.sign(getAuthSecretKey());
}

export async function applyAdminSessionToNextResponse(
  res: NextResponse,
  adminId: string,
  rememberMe: boolean,
  testMode: boolean,
): Promise<void> {
  const token = await signAdminSessionToken(adminId, rememberMe, testMode);
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
  };
  if (rememberMe) {
    res.cookies.set(ADMIN_SESSION_COOKIE, token, { ...base, maxAge: REMEMBER_COOKIE_MAX_AGE });
  } else {
    res.cookies.set(ADMIN_SESSION_COOKIE, token, base);
  }
}

export async function clearAdminSessionCookiesOnNextResponse(res: NextResponse): Promise<void> {
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  res.cookies.delete(ADMIN_IMPERSONATION_COOKIE);
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  store.delete(ADMIN_IMPERSONATION_COOKIE);
}

export async function signAdminImpersonationToken(params: {
  adminId: string;
  role: "client" | "trainer";
  targetId: string;
}): Promise<string> {
  return new SignJWT({
    t: "mf_admin_imp",
    aid: params.adminId,
    role: params.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.targetId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getAuthSecretKey());
}

export async function verifyAdminImpersonationToken(
  token: string,
): Promise<{ adminId: string; role: "client" | "trainer"; targetId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "mf_admin_imp") return null;
    const aid = typeof payload.aid === "string" ? payload.aid : null;
    const role = payload.role === "client" || payload.role === "trainer" ? payload.role : null;
    const targetId = typeof payload.sub === "string" ? payload.sub : null;
    if (!aid || !role || !targetId) return null;
    return { adminId: aid, role, targetId };
  } catch {
    return null;
  }
}

export function applyAdminImpersonationToNextResponse(res: NextResponse, token: string): void {
  res.cookies.set(ADMIN_IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: ADMIN_IMPERSONATION_MAX_AGE,
  });
}

export async function clearAdminImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_IMPERSONATION_COOKIE);
}

export function clearAdminImpersonationCookieOnNextResponse(res: NextResponse): void {
  res.cookies.delete(ADMIN_IMPERSONATION_COOKIE);
}

export async function signLoginChallengeToken(
  clientId: string,
  opts?: { stayLoggedIn?: boolean },
): Promise<string> {
  const rm = opts?.stayLoggedIn === false ? 0 : 1;
  return new SignJWT({ t: "login_challenge", rm })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getAuthSecretKey());
}

export async function verifyLoginChallengeToken(
  token: string,
): Promise<{ clientId: string; stayLoggedIn: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "login_challenge") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const stayLoggedIn = payload.rm !== 0;
    return { clientId: sub, stayLoggedIn };
  } catch {
    return null;
  }
}

export async function setLoginChallengeCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(LOGIN_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearLoginChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(LOGIN_CHALLENGE_COOKIE);
}

export async function signTrainerLoginChallengeToken(
  trainerId: string,
  opts?: { stayLoggedIn?: boolean; redirectAfterLogin?: TrainerPostAuthPath },
): Promise<string> {
  const rm = opts?.stayLoggedIn === false ? 0 : 1;
  const next = opts?.redirectAfterLogin;
  const body: Record<string, unknown> = { t: "trainer_login_challenge", rm };
  if (next) body.next = next;
  return new SignJWT(body)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(trainerId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getAuthSecretKey());
}

export async function verifyTrainerLoginChallengeToken(
  token: string,
): Promise<{ trainerId: string; stayLoggedIn: boolean; redirectAfter?: TrainerPostAuthPath } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "trainer_login_challenge") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const stayLoggedIn = payload.rm !== 0;
    const redirectAfter = normalizeTrainerPostAuthPath(payload.next);
    return { trainerId: sub, stayLoggedIn, ...(redirectAfter ? { redirectAfter } : {}) };
  } catch {
    return null;
  }
}

export async function setTrainerLoginChallengeCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(TRAINER_LOGIN_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearTrainerLoginChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);
}

export async function signRegistrationHoldToken(pendingId: string): Promise<string> {
  return new SignJWT({ t: "registration_hold" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(pendingId)
    .setIssuedAt()
    .setExpirationTime("72h")
    .sign(getAuthSecretKey());
}

export async function verifyRegistrationHoldToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "registration_hold") return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function setRegistrationHoldCookie(pendingId: string): Promise<void> {
  const token = await signRegistrationHoldToken(pendingId);
  const store = await cookies();
  store.set(REGISTRATION_HOLD_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 72,
  });
}

export async function clearRegistrationHoldCookie(): Promise<void> {
  const store = await cookies();
  store.delete(REGISTRATION_HOLD_COOKIE);
}

export async function getRegistrationHoldPendingId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(REGISTRATION_HOLD_COOKIE)?.value;
  if (!token) return null;
  return verifyRegistrationHoldToken(token);
}
