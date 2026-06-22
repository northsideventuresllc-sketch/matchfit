import {
  evaluateTrainerComplianceWindow,
  trainerComplianceWindowComplete,
  type TrainerComplianceWindowProfile,
} from "@/lib/trainer-compliance-window";
import { isTrainerComplianceComplete, type TrainerComplianceProfileFields } from "@/lib/trainer-compliance-complete";

export type TrainerAccessProfile = TrainerComplianceProfileFields &
  TrainerComplianceWindowProfile & {
    limitedDashboardUnlockedAt?: Date | string | null;
    registrationFeeHoldStatus?: string | null;
    hasPaidRegistrationFee?: boolean;
    dashboardActivatedAt?: Date | string | null;
    fitHubPromoEndsAt?: Date | string | null;
  };

export type TrainerLimitedDashboardProfile = {
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean;
  limitedDashboardUnlockedAt?: Date | string | null;
};

export function hasTrainerLimitedDashboardAccess(
  prof: TrainerLimitedDashboardProfile | null | undefined,
): boolean {
  if (!prof) return false;
  const hold = (prof.registrationFeeHoldStatus ?? "NOT_STARTED").trim().toUpperCase();
  if (hold === "HELD" || hold === "CAPTURED" || hold === "DEFERRED") return true;
  if (prof.hasPaidRegistrationFee) return true;
  return Boolean(prof.limitedDashboardUnlockedAt);
}

/** Marketplace + client-facing features (discover, chat, nudge, services, premium). */
export function hasTrainerFullPlatformAccess(prof: TrainerAccessProfile | null | undefined): boolean {
  if (!prof || !hasTrainerLimitedDashboardAccess(prof)) return false;
  const window = evaluateTrainerComplianceWindow(prof);
  if (window.expired) return false;
  if (!trainerComplianceWindowComplete(prof)) return false;
  if (!isTrainerComplianceComplete(prof)) return false;
  const hold = (prof.registrationFeeHoldStatus ?? "").trim().toUpperCase();
  if (hold === "HELD") return false;
  return Boolean(prof.hasPaidRegistrationFee) || hold === "CAPTURED" || hold === "DEFERRED";
}

export function trainerFitHubPromoActive(prof: TrainerAccessProfile | null | undefined, now = new Date()): boolean {
  if (!hasTrainerFullPlatformAccess(prof)) return false;
  const ends = prof?.fitHubPromoEndsAt;
  if (!ends) return false;
  const d = typeof ends === "string" ? new Date(ends) : ends;
  return !Number.isNaN(d.getTime()) && d > now;
}
