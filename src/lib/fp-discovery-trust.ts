import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import {
  fpTrustIndicatorLabel,
  getFpTierPermissions,
  type FpTrustIndicator,
} from "@/lib/fp-tier-permissions";

export type FpDiscoveryTrustBadge = {
  tier: FpAccountTier | null;
  label: string;
  indicator: FpTrustIndicator | null;
  emoji: string;
};

export function fpDiscoveryTrustBadge(
  accountTier: string | null | undefined,
): FpDiscoveryTrustBadge | null {
  if (!accountTier || !isFpAccountTier(accountTier)) return null;
  const perms = getFpTierPermissions(accountTier);
  if (!perms) return null;
  const emoji = trustEmoji(perms.trust_indicator);
  return {
    tier: accountTier,
    label: fpTrustIndicatorLabel(perms.trust_indicator),
    indicator: perms.trust_indicator,
    emoji,
  };
}

function trustEmoji(indicator: FpTrustIndicator): string {
  switch (indicator) {
    case "verified":
    case "verified_premium":
    case "verified_business":
      return "✅";
    case "business_listed":
      return "🏢";
    default:
      return "";
  }
}

export function fpTierBadgeLabel(accountTier: string | null | undefined): string | null {
  if (!accountTier || !isFpAccountTier(accountTier)) return null;
  return getFpTierPermissions(accountTier)?.badge ?? null;
}
