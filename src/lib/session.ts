import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const CLIENT_SESSION_COOKIE = "mf_client_session";
export const LOGIN_CHALLENGE_COOKIE = "mf_login_challenge";
export const REGISTRATION_HOLD_COOKIE = "mf_registration_hold";

const REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
    secure: process.env.NODE_ENV === "production",
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
  if (!token) return null;
  return verifySessionToken(token);
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearLoginChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(LOGIN_CHALLENGE_COOKIE);
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
    secure: process.env.NODE_ENV === "production",
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
