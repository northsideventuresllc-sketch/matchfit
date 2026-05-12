import { prisma } from "@/lib/prisma";
import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

export function resendFromEnv(): string {
  const f = process.env.RESEND_FROM_EMAIL?.trim();
  return f && f.includes("@") ? f : RESEND_ONBOARDING_FROM;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSixDigitNumericString(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export async function findClientEmailChannel(clientId: string, email: string) {
  const norm = normalizeEmail(email);
  let row = await prisma.clientTwoFactorChannel.findFirst({
    where: { clientId, delivery: "EMAIL", email: { equals: norm, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) {
    row = await prisma.clientTwoFactorChannel.findFirst({
      where: { clientId, delivery: "EMAIL", isDefaultLogin: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!row) {
    row = await prisma.clientTwoFactorChannel.findFirst({
      where: { clientId, delivery: "EMAIL" },
      orderBy: { createdAt: "asc" },
    });
  }
  return row;
}

export async function findTrainerEmailChannel(trainerId: string, email: string) {
  const norm = normalizeEmail(email);
  let row = await prisma.trainerTwoFactorChannel.findFirst({
    where: { trainerId, delivery: "EMAIL", email: { equals: norm, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) {
    row = await prisma.trainerTwoFactorChannel.findFirst({
      where: { trainerId, delivery: "EMAIL", isDefaultLogin: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!row) {
    row = await prisma.trainerTwoFactorChannel.findFirst({
      where: { trainerId, delivery: "EMAIL" },
      orderBy: { createdAt: "asc" },
    });
  }
  return row;
}

export type StoredEmailCodeCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "mismatch" };

export function verifyStoredEmailCode(
  ch: { lastCode: string | null; expiresAt: Date | null },
  code: string,
): StoredEmailCodeCheck {
  if (!ch.lastCode || !ch.expiresAt) return { ok: false, reason: "missing" };
  if (ch.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (ch.lastCode !== code) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

export type Send2FACodeOptions = {
  /** When true (explicit “Resend”), stamps {@link lastEmailResendAt} for the 60s throttle. Login sends clear it. */
  countTowardResendCooldown?: boolean;
};

/**
 * Generates a 6-digit code, stores it on the EMAIL 2FA channel row, and sends it via Resend.
 */
export async function send2FACode(
  email: string,
  userId: string,
  userType: "CLIENT" | "TRAINER",
  opts?: Send2FACodeOptions,
): Promise<void> {
  const code = generateSixDigitNumericString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const norm = normalizeEmail(email);
  const lastEmailResendAt = opts?.countTowardResendCooldown ? new Date() : null;

  if (userType === "CLIENT") {
    const existing = await findClientEmailChannel(userId, norm);
    if (existing) {
      await prisma.clientTwoFactorChannel.update({
        where: { id: existing.id },
        data: { lastCode: code, expiresAt, email: norm, lastEmailResendAt },
      });
    } else {
      await prisma.clientTwoFactorChannel.create({
        data: {
          clientId: userId,
          delivery: "EMAIL",
          email: norm,
          lastCode: code,
          expiresAt,
          lastEmailResendAt,
          verified: false,
          isDefaultLogin: true,
        },
      });
    }
  } else {
    const existing = await findTrainerEmailChannel(userId, norm);
    if (existing) {
      await prisma.trainerTwoFactorChannel.update({
        where: { id: existing.id },
        data: { lastCode: code, expiresAt, email: norm, lastEmailResendAt },
      });
    } else {
      await prisma.trainerTwoFactorChannel.create({
        data: {
          trainerId: userId,
          delivery: "EMAIL",
          email: norm,
          lastCode: code,
          expiresAt,
          lastEmailResendAt,
          verified: false,
          isDefaultLogin: true,
        },
      });
    }
  }

  const from = resendFromEnv();
  const subject = "Your Match Fit verification code";
  const text = `Your verification code is: ${code}\n\nIt expires in 10 minutes. If you did not try to sign in, you can ignore this email.`;
  const html = `<p style="margin:0 0 16px;font-family:system-ui,sans-serif;font-size:15px;color:#111">Your verification code is:</p>
<p style="margin:0 0 20px;font-family:ui-monospace,monospace;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#111">${code}</p>
<p style="margin:0;font-family:system-ui,sans-serif;font-size:13px;color:#555">Expires in 10 minutes. If you did not try to sign in, ignore this message.</p>`;

  await sendResendEmail({ from, to: norm, subject, text, html });
}

export const RESEND_COOLDOWN_MS = 60_000;

/** Server-side helper for the verify page initial resend countdown (not a React render path). */
export function initialResendCooldownSecondsFromLastSend(
  lastEmailResendAt: Date | null | undefined,
): number {
  if (!lastEmailResendAt) return 0;
  const elapsed = Date.now() - lastEmailResendAt.getTime();
  if (elapsed >= RESEND_COOLDOWN_MS) return 0;
  return Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
}

export async function assertEmailResendCooldown(
  lastEmailResendAt: Date | null | undefined,
): Promise<{ ok: true } | { ok: false; waitSeconds: number }> {
  if (!lastEmailResendAt) return { ok: true };
  const elapsed = Date.now() - lastEmailResendAt.getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return { ok: false, waitSeconds };
  }
  return { ok: true };
}
