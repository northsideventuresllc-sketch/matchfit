import { describe, expect, it } from "vitest";
import {
  clientDeliveryModesRequireGeographicFilter,
  clientDiscoveryBypassesRegionalPools,
} from "@/lib/client-geographic-filter";
import { defaultClientMatchPreferences } from "@/lib/client-match-preferences";

describe("client-geographic-filter", () => {
  it("treats virtual-only clients as nationwide", () => {
    expect(
      clientDiscoveryBypassesRegionalPools({
        ...defaultClientMatchPreferences,
        deliveryModes: ["virtual"],
      }),
    ).toBe(true);
  });

  it("treats diy-only clients as nationwide", () => {
    expect(
      clientDiscoveryBypassesRegionalPools({
        ...defaultClientMatchPreferences,
        deliveryModes: ["diy"],
      }),
    ).toBe(true);
  });

  it("does not bypass when in-person is selected", () => {
    expect(
      clientDiscoveryBypassesRegionalPools({
        ...defaultClientMatchPreferences,
        deliveryModes: ["virtual", "in_person"],
      }),
    ).toBe(false);
  });

  it("flags location-bound delivery modes", () => {
    expect(clientDeliveryModesRequireGeographicFilter(["mobile"])).toBe(true);
    expect(clientDeliveryModesRequireGeographicFilter(["virtual", "diy"])).toBe(false);
  });
});
