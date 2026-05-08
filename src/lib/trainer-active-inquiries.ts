import type { GovernanceDiyEngagement, TrainerPairGovernancePayload } from "@/lib/marketplace-governance-overview";

function diyNeedsTrainerAttention(e: GovernanceDiyEngagement | undefined): boolean {
  if (!e) return false;
  if (e.extensionStatus === "PENDING") return true;
  if (e.clientReceivableAcknowledgedAt) return false;
  if (e.status === "MISSED" || e.status === "REFUND_ALERT_SENT") return false;
  return true;
}

/** Paid session package, unlimited cadence, or add-on pool on latest purchase. */
export function trainerPairHasPaidService(p: TrainerPairGovernancePayload): boolean {
  if (p.credits.sessionCreditsPurchased > 0 || p.credits.bookingUnlimitedAfterPurchase) return true;
  if (p.addons && p.addons.totalUnitsFromLatestPurchase > 0) return true;
  return false;
}

/**
 * True when there is nothing left to schedule, no open check-in rows, and DIY receivable cycle is quiet.
 */
export function trainerPairServiceFullySettled(p: TrainerPairGovernancePayload): boolean {
  if (p.upcomingBookings.length > 0) return false;
  if (!p.credits.bookingUnlimitedAfterPurchase && p.credits.creditsRemaining > 0) return false;
  const openCheckIn = p.checkInSessions.some((s) => s.uiPhase !== "closed" && s.uiPhase !== "hidden");
  if (openCheckIn) return false;
  if (diyNeedsTrainerAttention(p.engagements[0])) return false;
  return true;
}

export function trainerPairIsActiveInquiry(p: TrainerPairGovernancePayload): boolean {
  return trainerPairHasPaidService(p) && !trainerPairServiceFullySettled(p);
}
