import type { ClientMatchPreferences } from "@/lib/client-match-preferences";
import { clientPrefersVirtualOrDiy } from "@/lib/client-feed-timezone-preference";

/** Delivery modes that require Atlanta geocircle / ZIP-prefix / radius matching. */
export const LOCATION_BOUND_DELIVERY_MODES = ["in_person", "mobile"] as const;

/** Delivery modes eligible nationwide (all US states) during beta. */
export const NATIONWIDE_DELIVERY_MODES = ["virtual", "diy", "nutrition_planning"] as const;

export function clientDeliveryModesRequireGeographicFilter(
  deliveryModes: ClientMatchPreferences["deliveryModes"],
): boolean {
  return deliveryModes.some((mode) =>
    (LOCATION_BOUND_DELIVERY_MODES as readonly string[]).includes(mode),
  );
}

/**
 * True when the client's selected delivery modes are virtual/DIY-only (no in-person or mobile).
 * Those clients should bypass Atlanta geocircle and regional ZIP-prefix pools.
 */
export function clientDiscoveryBypassesRegionalPools(prefs: ClientMatchPreferences): boolean {
  return clientPrefersVirtualOrDiy(prefs) && !clientDeliveryModesRequireGeographicFilter(prefs.deliveryModes);
}
