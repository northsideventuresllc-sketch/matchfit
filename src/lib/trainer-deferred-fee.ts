import { createHash } from "node:crypto";
import { computeTrainerRegistrationDueCents } from "@/lib/trainer-registration-fee";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { prisma } from "@/lib/prisma";

export const DEFERRED_FEE_DAYS = 60;
export const DEFERRED_FEE_GRACE_HOURS = 72;
export const DEFERRED_FEE_MIN_WITHHOLD_PCT = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

export function computeDeferredFeeDeadlines(startAt: Date): { deadlineAt: Date; graceDeadlineAt: Date } {
  const deadlineAt = new Date(startAt.getTime() + DEFERRED_FEE_DAYS * MS_PER_DAY);
  const graceDeadlineAt = new Date(deadlineAt.getTime() + DEFERRED_FEE_GRACE_HOURS * MS_PER_HOUR);
  return { deadlineAt, graceDeadlineAt };
}

export function computeWithholdAmountCents(
  payoutCents: number,
  withholdPct: number,
  remainingBalanceCents: number,
): number {
  const pct = Math.min(100, Math.max(DEFERRED_FEE_MIN_WITHHOLD_PCT, Math.floor(withholdPct)));
  const gross = Math.max(0, Math.floor(payoutCents));
  const balance = Math.max(0, Math.floor(remainingBalanceCents));
  if (balance <= 0 || gross <= 0) return 0;
  const raw = Math.ceil(gross * (pct / 100));
  return Math.min(balance, raw);
}

export async function applyWithholdToPayout(
  trainerId: string,
  grossPayoutCents: number,
): Promise<{ netPayoutCents: number; withheld: number }> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: true,
      registrationFeeWithholdPct: true,
      email: true,
    },
  });
  if (!trainer?.registrationFeeDeferred || trainer.registrationFeeDeferredBalanceCents <= 0) {
    return { netPayoutCents: Math.max(0, grossPayoutCents), withheld: 0 };
  }

  const withheld = computeWithholdAmountCents(
    grossPayoutCents,
    trainer.registrationFeeWithholdPct,
    trainer.registrationFeeDeferredBalanceCents,
  );
  const netPayoutCents = Math.max(0, grossPayoutCents - withheld);
  const newBalance = Math.max(0, trainer.registrationFeeDeferredBalanceCents - withheld);

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      registrationFeeDeferredBalanceCents: newBalance,
      ...(newBalance === 0
        ? {
            registrationFeeDeferred: false,
          }
        : {}),
    },
  });

  if (newBalance === 0 && withheld > 0) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://match-fit.net";
    void sendTransactionalEmailIfAllowed({
      kind: "TRAINER_DEFERRED_FEE_CLEARED",
      to: trainer.email,
      audience: "TRAINER",
      trainerId,
      variables: {
        trainerDashboardUrl: `${origin}/trainer/dashboard`,
      },
    }).catch((e) => console.error("[deferred fee] cleared email failed:", e));
  }

  return { netPayoutCents, withheld };
}

export function isTrainerDeferredFeeBanned(trainer: { registrationFeeDeferredBannedAt: Date | null }): boolean {
  return Boolean(trainer.registrationFeeDeferredBannedAt);
}

function hashSsn(ssnRaw: string): string {
  const normalized = ssnRaw.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function banTrainerDeferredFee(trainerId: string): Promise<void> {
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { w9Json: true },
  });

  let ssnHash: string | null = null;
  if (profile?.w9Json) {
    try {
      const parsed = JSON.parse(profile.w9Json) as { tin?: string };
      const tin = typeof parsed.tin === "string" ? parsed.tin.trim() : "";
      if (tin) ssnHash = hashSsn(tin);
    } catch {
      /* ignore malformed w9 */
    }
  }

  const now = new Date();
  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      registrationFeeDeferredBannedAt: now,
      registrationFeeDeferredBanSsnHash: ssnHash ?? undefined,
      accountDeactivatedAt: now,
      safetySuspended: true,
      safetySuspendedAt: now,
    },
  });
}

export async function checkSsnAlreadyBanned(ssnRaw: string): Promise<boolean> {
  const hash = hashSsn(ssnRaw);
  const hit = await prisma.trainer.findFirst({
    where: {
      registrationFeeDeferredBanSsnHash: hash,
      registrationFeeDeferredBannedAt: { not: null },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

/** Initialize deferred balance when compliance completes for a deferred-fee trainer. */
export async function activateTrainerDeferredFeeOnCompliance(trainerId: string): Promise<void> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { registrationFeeDeferred: true },
  });
  if (!trainer?.registrationFeeDeferred) return;

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      registrationFeePricingMode: true,
      backgroundCheckVendorPaidCents: true,
      registrationFeeHoldStatus: true,
    },
  });
  if (!profile || profile.registrationFeeHoldStatus !== "DEFERRED") return;

  const bgPaid = profile.backgroundCheckVendorPaidCents ?? 0;
  const { dueCents } = computeTrainerRegistrationDueCents({
    pricingMode: "STANDARD_100_MINUS_BG",
    backgroundCheckVendorPaidCents: bgPaid > 0 ? bgPaid : 4900,
  });
  if (dueCents <= 0) return;

  const now = new Date();
  const { deadlineAt, graceDeadlineAt } = computeDeferredFeeDeadlines(now);

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      registrationFeeDeferred: true,
      registrationFeeDeferredBalanceCents: dueCents,
      registrationFeeDeferredStartAt: now,
      registrationFeeDeferredDeadlineAt: deadlineAt,
      registrationFeeGraceDeadlineAt: null,
    },
  });

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      hasPaidRegistrationFee: true,
      registrationFeePaidCents: 0,
      updatedAt: now,
    },
  });
}