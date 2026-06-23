import type { FpAccountTier, FpListingStatus } from "@/lib/fp-account-tier-types";
import { getFpTierPermissions } from "@/lib/fp-tier-permissions";

export type FpFitHubAccessProfile = {
  accountTier: string | null;
  listingStatus: string;
};

/** All tiers get full FitHub when tier is set and listing is not suspended. */
export function hasFpFitHubAccess(prof: FpFitHubAccessProfile | null | undefined): boolean {
  if (!prof?.accountTier) return false;
  return prof.listingStatus !== "suspended";
}

export function isFpListingVisibleInDiscovery(prof: {
  accountTier: string | null;
  listingStatus: string;
} | null | undefined): boolean {
  if (!prof?.accountTier) return true; // legacy trainers without tier assignment
  const perms = getFpTierPermissions(prof.accountTier as FpAccountTier);
  if (!perms?.appear_in_discovery) return false;
  const status = prof.listingStatus as FpListingStatus;
  return status === "active" || status === "pending_docs" || status === "pending_background";
}

export type ClientTrainerDiscoveryFilter = "in_house" | "listed_businesses" | "both";

export function fpTierMatchesDiscoveryFilter(
  tier: FpAccountTier | null,
  filter: ClientTrainerDiscoveryFilter,
): boolean {
  if (filter === "both" || !tier) return true;
  const inHouse: FpAccountTier[] = ["match_fit_pro", "match_fit_premium_pro"];
  const listed: FpAccountTier[] = ["independent_fitness_pro", "elite_fitness_pro"];
  if (filter === "in_house") return inHouse.includes(tier);
  return listed.includes(tier);
}
