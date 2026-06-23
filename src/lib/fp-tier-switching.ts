import type { Prisma } from "@/generated/prisma/client";
import {
  FP_DOCS_MAX_REJECTIONS_PER_24H,
  FP_TIER_SWITCH_LOCK_DAYS,
  type FpAccountTier,
  type FpListingStatus,
  fpTierRequiresBackgroundCheck,
  fpTierRequiresMonthlyFee,
  isFpAccountTier,
} from "@/lib/fp-account-tier-types";
import { fpDocsCompleteForTier, type FpDocSubmissionSummary } from "@/lib/fp-tier-docs";

export const FP_TIER_SWITCH_ACTIVE_SESSIONS_BLOCK_MESSAGE =
  "Close all active sessions before switching your account type.";

export type FpTierProfileFields = {
  accountTier: string | null;
  tierSwitchedAt: Date | string | null;
  tierSwitchCount: number;
  pendingTier: string | null;
  listingStatus: string;
  backgroundCheckPassed: boolean;
  billingCycleEnd: Date | string | null;
  docsApproved: boolean;
  docsRejectionCount: number;
  docsLastRejectedAt: Date | string | null;
  promoteTokensBalance: number;
};

export type FpTierSwitchBlockReason =
  | "lock_active"
  | "active_sessions"
  | "invalid_tier"
  | "same_tier";

export type FpTierSwitchEligibility = {
  allowed: boolean;
  reason: FpTierSwitchBlockReason | null;
  lockEndsAt: Date | null;
  activeSessionCount: number;
};

const MS_PER_DAY = 86_400_000;

export function fpTierSwitchLockEndsAt(
  prof: Pick<FpTierProfileFields, "tierSwitchedAt">,
): Date | null {
  if (!prof.tierSwitchedAt) return null;
  const switched = new Date(prof.tierSwitchedAt);
  if (Number.isNaN(switched.getTime())) return null;
  return new Date(switched.getTime() + FP_TIER_SWITCH_LOCK_DAYS * MS_PER_DAY);
}

export function fpTierSwitchLockActive(
  prof: Pick<FpTierProfileFields, "tierSwitchedAt">,
  now = new Date(),
): boolean {
  const ends = fpTierSwitchLockEndsAt(prof);
  return ends != null && ends.getTime() > now.getTime();
}

export function evaluateFpTierSwitchEligibility(
  prof: FpTierProfileFields,
  targetTier: string,
  activeSessionCount: number,
  now = new Date(),
): FpTierSwitchEligibility {
  if (!isFpAccountTier(targetTier)) {
    return { allowed: false, reason: "invalid_tier", lockEndsAt: null, activeSessionCount };
  }
  if (prof.accountTier === targetTier) {
    return { allowed: false, reason: "same_tier", lockEndsAt: null, activeSessionCount };
  }
  const lockEndsAt = fpTierSwitchLockEndsAt(prof);
  if (lockEndsAt && lockEndsAt.getTime() > now.getTime()) {
    return { allowed: false, reason: "lock_active", lockEndsAt, activeSessionCount };
  }
  if (activeSessionCount > 0) {
    return { allowed: false, reason: "active_sessions", lockEndsAt: null, activeSessionCount };
  }
  return { allowed: true, reason: null, lockEndsAt: null, activeSessionCount };
}

export function resolveListingStatusAfterTierSwitch(
  targetTier: FpAccountTier,
  prof: Pick<FpTierProfileFields, "backgroundCheckPassed" | "docsApproved">,
  docs: FpDocSubmissionSummary[],
): FpListingStatus {
  if (!fpDocsCompleteForTier(targetTier, docs) && !prof.docsApproved) {
    return "pending_docs";
  }
  if (fpTierRequiresBackgroundCheck(targetTier) && !prof.backgroundCheckPassed) {
    return "pending_background";
  }
  return "active";
}

export function fpDocsRejectionRateLimited(
  prof: Pick<FpTierProfileFields, "docsRejectionCount" | "docsLastRejectedAt">,
  now = new Date(),
): boolean {
  if (!prof.docsLastRejectedAt) return false;
  const last = new Date(prof.docsLastRejectedAt);
  if (Number.isNaN(last.getTime())) return false;
  const within24h = now.getTime() - last.getTime() < MS_PER_DAY;
  return within24h && prof.docsRejectionCount >= FP_DOCS_MAX_REJECTIONS_PER_24H;
}

export type FpTierSwitchBillingEffect = {
  startsPaidBilling: boolean;
  pausesListingOnSwitchFromPaid: boolean;
  billingStartsAfterCycleEnd: boolean;
};

export function resolveFpTierSwitchBillingEffect(
  fromTier: FpAccountTier | null,
  toTier: FpAccountTier,
): FpTierSwitchBillingEffect {
  const toPaid = fpTierRequiresMonthlyFee(toTier);
  const fromPaid = fromTier != null && fpTierRequiresMonthlyFee(fromTier);
  return {
    startsPaidBilling: toPaid && !fromPaid,
    pausesListingOnSwitchFromPaid: fromPaid && !toPaid && toTier === "match_fit_pro",
    billingStartsAfterCycleEnd: toPaid,
  };
}

export type FpTierSwitchWriteData = {
  accountTier?: string;
  pendingTier?: string | null;
  listingStatus: string;
  tierSwitchedAt: Date;
  tierSwitchCount: { increment: number };
};

export function buildFpTierSwitchProfileUpdate(
  fromTier: FpAccountTier | null,
  toTier: FpAccountTier,
  listingStatus: FpListingStatus,
  billingEffect: FpTierSwitchBillingEffect,
  now: Date,
): FpTierSwitchWriteData {
  if (billingEffect.billingStartsAfterCycleEnd) {
    return {
      pendingTier: toTier,
      listingStatus: billingEffect.pausesListingOnSwitchFromPaid ? "paused" : listingStatus,
      tierSwitchedAt: now,
      tierSwitchCount: { increment: 1 },
    };
  }
  return {
    accountTier: toTier,
    pendingTier: null,
    listingStatus,
    tierSwitchedAt: now,
    tierSwitchCount: { increment: 1 },
  };
}

export async function countTrainerActiveSessions(
  tx: Prisma.TransactionClient,
  trainerId: string,
): Promise<number> {
  return tx.bookedTrainingSession.count({
    where: {
      trainerId,
      status: { in: ["INVITED", "CLIENT_CONFIRMED", "PENDING_CONFIRMATION"] },
      sessionClosedAt: null,
    },
  });
}
