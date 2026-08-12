import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { signPasswordChangeToken } from "@/lib/password-change-jwt";
import { deliverPasswordResetEmail } from "@/lib/deliver-password-reset-email";
import { clearSecurityLock, type SecurityLockAccountType } from "@/lib/account-security-lock";
import { getAppOriginFromRequest } from "@/lib/app-origin";

/**
 * Admin support tool for helping a locked-out or confused user — the console JB asked for so
 * this doesn't have to happen by hand in the database every time. Every action here mirrors a
 * self-service one (same reset-token flow, same unlock), triggered on the user's behalf.
 */

export type AdminAccountSearchResult = {
  accountType: "client" | "trainer";
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  securityLockedAt: string | null;
};

export async function searchAccountsForSupport(query: string): Promise<AdminAccountSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [clients, trainers] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, securityLockedAt: true },
      take: 10,
    }),
    prisma.trainer.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, securityLockedAt: true },
      take: 10,
    }),
  ]);

  return [
    ...clients.map((c) => ({ accountType: "client" as const, ...c, securityLockedAt: c.securityLockedAt?.toISOString() ?? null })),
    ...trainers.map((t) => ({ accountType: "trainer" as const, ...t, securityLockedAt: t.securityLockedAt?.toISOString() ?? null })),
  ];
}

export async function getAccountDetailForSupport(accountType: "client" | "trainer", id: string) {
  if (accountType === "client") {
    return prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        zipCode: true,
        countryCode: true,
        createdAt: true,
        safetySuspended: true,
        securityLockedAt: true,
        securityLockReason: true,
        twoFactorEnabled: true,
      },
    });
  }
  return prisma.trainer.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      phone: true,
      createdAt: true,
      safetySuspended: true,
      securityLockedAt: true,
      securityLockReason: true,
      twoFactorEnabled: true,
      profile: { select: { serviceZipCode: true, countryCode: true } },
    },
  });
}

/** Sends a reset link the same way self-service forgot-password does, on the admin's initiative. */
export async function adminTriggerPasswordReset(
  accountType: "client" | "trainer",
  id: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account =
    accountType === "client"
      ? await prisma.client.findUnique({ where: { id }, select: { id: true, email: true } })
      : await prisma.trainer.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!account) return { ok: false, error: "Account not found." };

  const nonce = randomBytes(24).toString("hex");
  const token = await signPasswordChangeToken(account.id, nonce);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  if (accountType === "client") {
    await prisma.client.update({ where: { id }, data: { passwordChangeNonce: nonce, passwordChangeExpires: expiresAt } });
  } else {
    await prisma.trainer.update({ where: { id }, data: { passwordChangeNonce: nonce, passwordChangeExpires: expiresAt } });
  }

  const origin = getAppOriginFromRequest(req);
  const resetUrl = `${origin}/${accountType}/reset-password?token=${encodeURIComponent(token)}`;
  await deliverPasswordResetEmail({ email: account.email, resetUrl });
  return { ok: true };
}

export async function adminUnlockAccount(accountType: SecurityLockAccountType, id: string): Promise<void> {
  await clearSecurityLock(accountType, id);
}

export async function adminUpdateAccountIdentity(
  accountType: "client" | "trainer",
  id: string,
  fields: { email?: string; username?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data: { email?: string; username?: string } = {};
  if (fields.email !== undefined) data.email = fields.email.trim().toLowerCase();
  if (fields.username !== undefined) data.username = fields.username.trim();
  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update." };

  try {
    if (accountType === "client") {
      await prisma.client.update({ where: { id }, data });
    } else {
      await prisma.trainer.update({ where: { id }, data });
    }
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") {
      return { ok: false, error: "That email or username is already in use by another account." };
    }
    throw e;
  }
}
