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

/**
 * Phone is stored as whatever the coach typed at signup (no E.164 enforcement there — see
 * validations/trainer-register.ts), so the same real number can be on file as "2025550299" or
 * "+12025550299" depending on whether they included a country code. A raw digit-for-digit
 * compare made those look like different numbers and silently failed the match (the generic
 * response hides that from the user, so it looked like the feature "just didn't work" rather
 * than an error). Stripping a leading NANP "1" from an 11-digit number makes both forms compare
 * equal without weakening the check — a phone match still requires the exact same
 * username+email pair to have matched first.
 */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
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
