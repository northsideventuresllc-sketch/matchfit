import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export async function signEmailChangeToken(
  clientId: string,
  nonce: string,
  newEmail: string,
): Promise<string> {
  const e = newEmail.trim().toLowerCase();
  return new SignJWT({ p: "email_change", n: nonce, e })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getAuthSecretKey());
}

export async function verifyEmailChangeToken(
  token: string,
): Promise<{ clientId: string; nonce: string; newEmail: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.p !== "email_change" || typeof payload.n !== "string" || typeof payload.e !== "string") {
      return null;
    }
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { clientId: sub, nonce: payload.n, newEmail: payload.e };
  } catch {
    return null;
  }
}
