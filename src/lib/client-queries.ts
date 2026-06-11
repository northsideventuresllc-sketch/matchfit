import type { Prisma } from "@/generated/prisma/client";
import { getValidBetaInvite } from "@/lib/beta-waitlist-service";
import { normalizeLoginIdentifier } from "@/lib/login-identifier";
import { prisma } from "@/lib/prisma";

const ACTIVE_HOLD_STATUSES = ["PENDING_2FA", "AWAITING_PAYMENT"] as const;

export async function findClientByIdentifier(identifier: string) {
  const parts = normalizeLoginIdentifier(identifier);
  const or: Prisma.ClientWhereInput[] = [];
  if (parts.email) or.push({ email: parts.email });
  if (parts.phone) or.push({ phone: parts.phone });
  if (parts.username) {
    or.push({ username: { equals: parts.username, mode: "insensitive" } });
  }
  if (or.length === 0) return null;
  return prisma.client.findFirst({
    where: {
      deidentifiedAt: null,
      OR: or,
    },
  });
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = username.trim();
  const existing = await prisma.client.findFirst({ where: { username: u, deidentifiedAt: null } });
  if (existing) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      username: u,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  if (pending) return true;
  const now = new Date();
  const reserved = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      status: "INVITED",
      slotExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  return Boolean(reserved);
}

export async function isEmailTaken(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const existing = await prisma.client.findFirst({ where: { email: e, deidentifiedAt: null } });
  if (existing) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      email: e,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  if (pending) return true;
  const now = new Date();
  const wl = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      email: e,
      status: "INVITED",
      slotExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  return Boolean(wl);
}

/** Returns a deactivated client eligible for paid reactivation (not deidentified). */
export async function findDeactivatedClientForReactivation(email: string) {
  const e = email.trim().toLowerCase();
  return prisma.client.findFirst({
    where: {
      email: e,
      deidentifiedAt: null,
      accountDeactivatedAt: { not: null },
    },
    select: {
      id: true,
      email: true,
      username: true,
      platformTrialConsumed: true,
    },
  });
}

/** True if another account (or pending registration) already uses this email. */
export async function isEmailTakenByAnother(email: string, excludeClientId: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const other = await prisma.client.findFirst({
    where: { email: e, deidentifiedAt: null, NOT: { id: excludeClientId } },
  });
  if (other) return true;
  const pendingHolder = await prisma.client.findFirst({
    where: { pendingEmail: e, deidentifiedAt: null, NOT: { id: excludeClientId } },
  });
  if (pendingHolder) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      email: e,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  if (pending) return true;
  const wl = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      email: e,
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(wl);
}

/** True if another account (or pending registration) already uses this phone. */
export async function isPhoneTakenByAnother(phone: string, excludeClientId: string): Promise<boolean> {
  const p = phone.trim();
  const other = await prisma.client.findFirst({
    where: { phone: p, deidentifiedAt: null, NOT: { id: excludeClientId } },
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

function sanitizeClientUsernameBase(firstName: string): string {
  const base = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (base.length >= 3) return base.slice(0, 24);
  const padded = `fit${base || "user"}`.slice(0, 24);
  return padded.length >= 3 ? padded : `${padded}00`.slice(0, 3);
}

/** Server-generated unique handle from first name (letters, numbers, underscores). */
export async function generateUniqueClientUsername(firstName: string): Promise<string> {
  const base = sanitizeClientUsernameBase(firstName);
  if (!(await isUsernameTaken(base))) return base;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${base.slice(0, Math.max(3, 32 - suffix.length))}${suffix}`.slice(0, 32);
    if (!(await isUsernameTaken(candidate))) return candidate;
  }
  throw new Error("Could not generate a unique username.");
}

export async function resolveClientRegistrationUsername(args: {
  firstName: string;
  email: string;
  betaInviteToken?: string | null;
}): Promise<{ username: string } | { error: string }> {
  const email = args.email.trim().toLowerCase();
  const token = args.betaInviteToken?.trim();
  if (token) {
    const inv = await getValidBetaInvite(token);
    const reserved = inv?.role === "client" && inv.email === email ? inv.desiredUsername?.trim() : "";
    if (reserved) {
      if (await isUsernameTaken(reserved)) {
        return { error: "That username is already taken." };
      }
      return { username: reserved };
    }
  }
  return { username: await generateUniqueClientUsername(args.firstName) };
}

/** True if another account or an active registration hold already uses this username. */
export async function isUsernameTakenByAnother(username: string, excludeClientId: string): Promise<boolean> {
  const u = username.trim();
  const other = await prisma.client.findFirst({
    where: { username: u, deidentifiedAt: null, NOT: { id: excludeClientId } },
  });
  if (other) return true;
  const pending = await prisma.pendingClientRegistration.findFirst({
    where: {
      username: u,
      expiresAt: { gt: new Date() },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });
  if (pending) return true;
  const now = new Date();
  const reserved = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      status: "INVITED",
      slotExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  return Boolean(reserved);
}
