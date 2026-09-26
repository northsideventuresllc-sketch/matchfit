import { prisma } from "@/lib/prisma";
import { isTrainerComplianceComplete, type TrainerComplianceProfileFields } from "@/lib/trainer-compliance-complete";

export type FpListingStatusSyncProfile = TrainerComplianceProfileFields & {
  accountTier: string | null;
  listingStatus: string;
};

/**
 * Only these two "still onboarding" statuses are ever auto-advanced. `active`, `paused`, and
 * `suspended` are set by explicit tier-selection / admin / billing actions and must never be
 * silently overwritten by this sync.
 */
const AUTO_ADVANCE_FROM_STATUSES = new Set(["pending_docs", "pending_background"]);

/**
 * Compute the listingStatus a tiered Fitness Pro SHOULD have right now. Root-cause fix for
 * MF-PUBLIC-SEARCH-STUCK-LISTING-0923: a coach who cleared TOS + W-9 + background check +
 * certification review (the exact gates `isTrainerComplianceComplete` already checks — same
 * gates that unlock dashboard activation) could get stuck forever at "pending_background" or
 * "pending_docs" because nothing recomputed `listingStatus` once the LAST outstanding
 * requirement cleared (e.g. the Checkr webhook approving background check after documents/
 * certification were already approved). This never downgrades an explicit "active" / "paused" /
 * "suspended" status — it only ever advances a still-onboarding row forward once compliance is
 * genuinely complete.
 */
export function resolveFpListingStatusForCompliance(prof: FpListingStatusSyncProfile): string {
  if (!prof.accountTier) return prof.listingStatus; // untiered legacy trainers aren't managed by this gate
  if (!AUTO_ADVANCE_FROM_STATUSES.has(prof.listingStatus)) return prof.listingStatus;
  return isTrainerComplianceComplete(prof) ? "active" : prof.listingStatus;
}

const listingSyncSelect = {
  accountTier: true,
  listingStatus: true,
  hasSignedTOS: true,
  hasUploadedW9: true,
  backgroundCheckStatus: true,
  backgroundCheckClearedAt: true,
  onboardingTrackCpt: true,
  onboardingTrackNutrition: true,
  onboardingTrackSpecialist: true,
  certificationReviewStatus: true,
  nutritionistCertificationReviewStatus: true,
  specialistCertificationReviewStatus: true,
} as const;

/**
 * Idempotent — safe to call on every compliance-related event (background check webhook,
 * certification review, W-9 upload, doc approval, ...). Only writes when the computed status
 * actually differs from what's stored, so redundant calls are cheap no-ops. Returns the new
 * status when it changed, or null when nothing needed to change.
 */
export async function syncFpListingStatusForCompliance(trainerId: string): Promise<string | null> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: listingSyncSelect,
  });
  if (!prof) return null;

  const next = resolveFpListingStatusForCompliance(prof);
  if (next === prof.listingStatus) return null;

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: { listingStatus: next, updatedAt: new Date() },
  });
  return next;
}

/**
 * Safe idempotent repair pass for coaches already stuck at pending_docs/pending_background from
 * before this sync existed. Reads/writes only through Prisma (existing app code) — no raw SQL,
 * no schema change — and re-running it is always a no-op once every stuck row has cleared.
 * Suitable for an admin action or a cron job.
 */
export async function repairStuckFpListingStatuses(): Promise<{
  checked: number;
  updatedTrainerIds: string[];
}> {
  const stuck = await prisma.trainerProfile.findMany({
    where: {
      accountTier: { not: null },
      listingStatus: { in: [...AUTO_ADVANCE_FROM_STATUSES] },
    },
    select: { trainerId: true, ...listingSyncSelect },
  });

  const updatedTrainerIds: string[] = [];
  for (const prof of stuck) {
    const next = resolveFpListingStatusForCompliance(prof);
    if (next === prof.listingStatus) continue;
    await prisma.trainerProfile.update({
      where: { trainerId: prof.trainerId },
      data: { listingStatus: next, updatedAt: new Date() },
    });
    updatedTrainerIds.push(prof.trainerId);
  }

  return { checked: stuck.length, updatedTrainerIds };
}
