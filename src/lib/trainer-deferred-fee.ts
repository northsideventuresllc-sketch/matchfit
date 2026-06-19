import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow";
import {
  DEFERRED_FEE_DAYS,
  DEFERRED_FEE_GRACE_HOURS,
  DEFERRED_FEE_MIN_WITHHOLD_PCT,
} from "@/lib/trainer-deferred-fee-constants";

export {
  DEFERRED_FEE_DAYS,
  DEFERRED_FEE_GRACE_HOURS,
  DEFERRED_FEE_MIN_WITHHOLD_PCT,
} from "@/lib/trainer-deferred-fee-constants";

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
  if (remainingBalanceCents <= 0 || payoutCents <= 0) return 0;
  const pct = Math.min(100, Math.max(DEFERRED_FEE_MIN_WITHHOLD_PCT, withholdPct));
  const raw = Math.ceil((payoutCents * pct) / 100);
  return Math.min(raw, remainingBalanceCents);
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
    return { netPayoutCents: grossPayoutCents, withheld: 0 };
  }

  const withheld = computeWithholdAmountCents(
    grossPayoutCents,
    trainer.registrationFeeWithholdPct,
    trainer.registrationFeeDeferredBalanceCents,
  );
  const newBalance = Math.max(0, trainer.registrationFeeDeferredBalanceCents - withheld);
  const cleared = newBalance === 0;

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      registrationFeeDeferredBalanceCents: newBalance,
      ...(cleared
        ? {
            registrationFeeDeferred: false,
            registrationFeeDeferredStartAt: null,
            registrationFeeDeferredDeadlineAt: null,
            registrationFeeGraceDeadlineAt: null,
          }
        : {}),
    },
  });

  if (cleared && trainer.email?.trim()) {
    void sendTransactionalEmailIfAllowed({
      kind: "TRAINER_DEFERRED_FEE_CLEARED",
      to: trainer.email.trim(),
      audience: "TRAINER",
      trainerId,
      variables: {
        trainerDashboardUrl:
          process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") + "/trainer/dashboard" ||
          "https://match-fit.net/trainer/dashboard",
      },
    }).catch((e) => console.error("[trainer-deferred-fee] cleared email failed:", e));
  }

  return { netPayoutCents: Math.max(0, grossPayoutCents - withheld), withheld };
}

export function isTrainerDeferredFeeBanned(trainer: { registrationFeeDeferredBannedAt: Date | null }): boolean {
  return Boolean(trainer.registrationFeeDeferredBannedAt);
}

function hashSsn(ssnRaw: string): string {
  const normalized = ssnRaw.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

function extractSsnFromW9Json(w9Json: string | null | undefined): string | null {
  if (!w9Json?.trim()) return null;
  try {
    const parsed = JSON.parse(w9Json) as { tinType?: string; tin?: string };
    const tinType = (parsed.tinType ?? "").trim().toUpperCase();
    const tin = (parsed.tin ?? "").trim();
    if (tinType === "SSN" && tin) return tin;
    return null;
  } catch {
    return null;
  }
}

export async function banTrainerDeferredFee(trainerId: string): Promise<void> {
  const now = new Date();
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { w9Json: true },
  });
  const ssnRaw = extractSsnFromW9Json(profile?.w9Json);
  const banSsnHash = ssnRaw ? hashSsn(ssnRaw) : null;

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      registrationFeeDeferredBannedAt: now,
      registrationFeeDeferredBanSsnHash: banSsnHash,
      accountDeactivatedAt: now,
      safetySuspended: true,
      safetySuspendedAt: now,
    },
  });
}

export async function checkSsnAlreadyBanned(ssnRaw: string): Promise<boolean> {
  const hash = hashSsn(ssnRaw);
  const hit = await prisma.trainer.findFirst({
    where: { registrationFeeDeferredBanSsnHash: hash },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function initializeTrainerDeferredFee(args: {
  trainerId: string;
  balanceCents: number;
  withholdPct: number;
}): Promise<void> {
  const now = new Date();
  const { deadlineAt } = computeDeferredFeeDeadlines(now);
  const withholdPct = Math.min(100, Math.max(DEFERRED_FEE_MIN_WITHHOLD_PCT, args.withholdPct));

  await prisma.$transaction([
    prisma.trainer.update({
      where: { id: args.trainerId },
      data: {
        registrationFeeDeferred: true,
        registrationFeeDeferredBalanceCents: args.balanceCents,
        registrationFeeDeferredStartAt: now,
        registrationFeeDeferredDeadlineAt: deadlineAt,
        registrationFeeGraceDeadlineAt: null,
        registrationFeeWithholdPct: withholdPct,
      },
    }),
    prisma.trainerProfile.update({
      where: { trainerId: args.trainerId },
      data: {
        registrationFeeHoldStatus: "DEFERRED",
        hasPaidRegistrationFee: false,
        updatedAt: now,
      },
    }),
  ]);
}

export async function applyTrainerDeferredSignupChoice(args: {
  trainerId: string;
  withholdPct: number;
}): Promise<void> {
  const withholdPct = Math.min(100, Math.max(DEFERRED_FEE_MIN_WITHHOLD_PCT, args.withholdPct));
  const now = new Date();
  await prisma.$transaction([
    prisma.trainer.update({
      where: { id: args.trainerId },
      data: {
        registrationFeeDeferred: true,
        registrationFeeDeferredBalanceCents: 0,
        registrationFeeWithholdPct: withholdPct,
      },
    }),
    prisma.trainerProfile.update({
      where: { trainerId: args.trainerId },
      data: {
        limitedDashboardUnlockedAt: now,
        complianceWindowStartedAt: now,
        updatedAt: now,
      },
    }),
  ]);
}

export async function activateTrainerDeferredFeeOnCompliance(
  trainerId: string,
  pricingMode: TrainerRegistrationPricingMode,
): Promise<void> {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { registrationFeeWithholdPct: true },
  });
  if (!trainer) return;
  await initializeTrainerDeferredFee({
    trainerId,
    balanceCents: split.platformEscrowCents,
    withholdPct: trainer.registrationFeeWithholdPct,
  });
}
