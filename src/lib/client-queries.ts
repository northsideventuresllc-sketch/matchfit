import { prisma } from "@/lib/prisma";

const ACTIVE_HOLD_STATUSES = ["PENDING_2FA", "AWAITING_PAYMENT"] as const;

export async function findClientByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  return prisma.client.findFirst({
    where: {
      OR: [{ username: raw }, { phone: raw }, { email: raw.toLowerCase() }],
    },
  });
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = username.trim();
  const existing = await prisma.client.findUnique({ where: { username: u } });
  if (existing) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      username: u,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  return Boolean(pending);
}

export async function isEmailTaken(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const existing = await prisma.client.findUnique({ where: { email: e } });
  if (existing) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      email: e,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  return Boolean(pending);
}

/** True if another account (or pending registration) already uses this email. */
export async function isEmailTakenByAnother(email: string, excludeClientId: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const other = await prisma.client.findFirst({
    where: { email: e, NOT: { id: excludeClientId } },
  });
  if (other) return true;
  const pendingHolder = await prisma.client.findFirst({
    where: { pendingEmail: e, NOT: { id: excludeClientId } },
  });
  if (pendingHolder) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      email: e,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  return Boolean(pending);
}

/** True if another account (or pending registration) already uses this phone. */
export async function isPhoneTakenByAnother(phone: string, excludeClientId: string): Promise<boolean> {
  const p = phone.trim();
  const other = await prisma.client.findFirst({
    where: { phone: p, NOT: { id: excludeClientId } },
  });
  if (other) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      phone: p,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  return Boolean(pending);
}

/** True if another account or an active registration hold already uses this username. */
export async function isUsernameTakenByAnother(username: string, excludeClientId: string): Promise<boolean> {
  const u = username.trim();
  const other = await prisma.client.findFirst({
    where: { username: u, NOT: { id: excludeClientId } },
  });
  if (other) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      username: u,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  return Boolean(pending);
}
