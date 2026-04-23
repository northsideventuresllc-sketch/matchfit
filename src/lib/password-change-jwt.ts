import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export async function signPasswordChangeToken(userId: string, nonce: string): Promise<string> {
  return new SignJWT({ p: "pwd_reset", n: nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getAuthSecretKey());
}

export async function verifyPasswordChangeToken(
  token: string,
): Promise<{ userId: string; nonce: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.p !== "pwd_reset" || typeof payload.n !== "string") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { userId: sub, nonce: payload.n };
  } catch {
    return null;
  }
}
