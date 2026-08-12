import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * The "this wasn't me" link on every password-changed email.
 *
 * Clicking it locks the account immediately — no further confirmation — because the whole
 * point is speed: if someone's password just got changed by an attacker, every second the
 * account stays open is the attacker's. The signed token means the link can't be forged or
 * pointed at a different account; it does not need to be single-use, since locking an
 * already-locked account is a harmless no-op.
 */

export type SecurityLockAccountType = "client" | "trainer" | "admin";

export async function signWasntMeToken(accountType: SecurityLockAccountType, accountId: string): Promise<string> {
  return new SignJWT({ p: "wasnt_me", t: accountType })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecretKey());
}

export async function verifyWasntMeToken(
  token: string,
): Promise<{ accountType: SecurityLockAccountType; accountId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.p !== "wasnt_me") return null;
    const accountType = payload.t;
    if (accountType !== "client" && accountType !== "trainer" && accountType !== "admin") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { accountType, accountId: sub };
  } catch {
    return null;
  }
}

const LOCK_REASON_PASSWORD_CHANGE_DISPUTED =
  "A password change on this account was reported as not authorized by the account owner.";

export async function lockAccountForSecurity(
  accountType: SecurityLockAccountType,
  accountId: string,
  reason: string = LOCK_REASON_PASSWORD_CHANGE_DISPUTED,
): Promise<void> {
  const data = { securityLockedAt: new Date(), securityLockReason: reason };
  if (accountType === "client") {
    await prisma.client.update({ where: { id: accountId }, data });
  } else if (accountType === "trainer") {
    await prisma.trainer.update({ where: { id: accountId }, data });
  } else {
    await prisma.administrator.update({ where: { id: accountId }, data });
  }
}

/** Admin support tool uses this to clear a lock once the account is confirmed safe. */
export async function clearSecurityLock(accountType: SecurityLockAccountType, accountId: string): Promise<void> {
  const data = { securityLockedAt: null, securityLockReason: null };
  if (accountType === "client") {
    await prisma.client.update({ where: { id: accountId }, data });
  } else if (accountType === "trainer") {
    await prisma.trainer.update({ where: { id: accountId }, data });
  } else {
    await prisma.administrator.update({ where: { id: accountId }, data });
  }
}
