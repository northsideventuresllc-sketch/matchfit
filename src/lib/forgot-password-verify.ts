import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Forgot-password identity checks.
 *
 * Every account type requires ALL of its fields to match the same account before a reset link
 * is sent — never a single field. This is deliberately stricter than most apps: JB's call,
 * because DOB/phone/email should never independently be enough to move someone into an account
 * that isn't theirs.
 *
 * Coaches have no date-of-birth field in this schema at all (confirmed — see the 2026-08-05
 * audit), so they use phone number instead: it's required at signup, never shown on any public
 * profile or API response, and every existing coach already has one on file.
 */

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** DOB is stored as YYYY-MM-DD; the reset form uses a native date input, which always submits
 *  that exact shape, so this is a plain trimmed string compare — no date parsing ambiguity. */
function normalizeDob(raw: string): string {
  return raw.trim();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeIdentifier(raw: string): string {
  return raw.trim();
}

export async function findClientForPasswordReset(args: {
  username: string;
  email: string;
  dateOfBirth: string;
}): Promise<{ id: string; email: string } | null> {
  const client = await prisma.client.findFirst({
    where: {
      username: { equals: normalizeIdentifier(args.username), mode: "insensitive" },
      email: { equals: normalizeEmail(args.email), mode: "insensitive" },
    },
    select: { id: true, email: true, dateOfBirth: true },
  });
  if (!client) return null;
  if (normalizeDob(client.dateOfBirth) !== normalizeDob(args.dateOfBirth)) return null;
  return { id: client.id, email: client.email };
}

export async function findTrainerForPasswordReset(args: {
  username: string;
  email: string;
  phone: string;
}): Promise<{ id: string; email: string } | null> {
  const trainer = await prisma.trainer.findFirst({
    where: {
      username: { equals: normalizeIdentifier(args.username), mode: "insensitive" },
      email: { equals: normalizeEmail(args.email), mode: "insensitive" },
    },
    select: { id: true, email: true, phone: true },
  });
  if (!trainer) return null;
  if (normalizePhoneDigits(trainer.phone) !== normalizePhoneDigits(args.phone)) return null;
  return { id: trainer.id, email: trainer.email };
}

export async function findAdminForPasswordReset(args: {
  adminCode: string;
  email: string;
  dateOfBirth: string;
}): Promise<{ id: string; email: string } | null> {
  const admin = await prisma.administrator.findFirst({
    where: {
      adminCode: { equals: normalizeIdentifier(args.adminCode), mode: "insensitive" },
      email: { equals: normalizeEmail(args.email), mode: "insensitive" },
    },
    select: { id: true, email: true, dateOfBirth: true },
  });
  if (!admin) return null;
  if (normalizeDob(admin.dateOfBirth) !== normalizeDob(args.dateOfBirth)) return null;
  return { id: admin.id, email: admin.email };
}
