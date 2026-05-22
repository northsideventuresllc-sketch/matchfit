import { describe, expect, it } from "vitest";
import {
  clampTrainerServiceSessionMinutes,
  mergeServiceOfferingFrequencyFields,
  parseTrainerServiceOfferingsJson,
  publicBrowseableSkuSummaries,
  resolveServiceCheckoutSku,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings-document";

function baseOfferingLine(): TrainerServiceOfferingLine {
  return {
    serviceId: "one_on_one_pt",
    delivery: "virtual",
    billingUnit: "per_session",
    priceUsd: 120,
    sessionMinutes: 60,
  };
}

describe("trainer-service-offerings-document helpers", () => {
  it("clamps and floors session minutes", () => {
    expect(clampTrainerServiceSessionMinutes(29.9)).toBe(30);
    expect(clampTrainerServiceSessionMinutes(45.6)).toBe(45);
    expect(clampTrainerServiceSessionMinutes(200)).toBe(120);
  });

  it("normalizes per-week frequency fields and legacy alias", () => {
    const line = baseOfferingLine();
    mergeServiceOfferingFrequencyFields(line, {
      sessionFrequencyKind: "per_week",
      sessionsPerWeek: 3,
    });

    expect(line.sessionFrequencyKind).toBe("per_week");
    expect(line.sessionFrequencyCount).toBe(3);
    expect(line.sessionsPerWeek).toBe(3);
    expect(line.sessionFrequencyCustom).toBeUndefined();
  });

  it("clears all cadence fields when frequency is none", () => {
    const line: TrainerServiceOfferingLine = {
      ...baseOfferingLine(),
      sessionFrequencyKind: "custom",
      sessionFrequencyCount: 7,
      sessionsPerWeek: 2,
      sessionFrequencyCustom: "Every Monday and Friday",
    };
    mergeServiceOfferingFrequencyFields(line, {
      sessionFrequencyKind: "none",
    });

    expect(line.sessionFrequencyKind).toBe("none");
    expect(line.sessionFrequencyCount).toBeUndefined();
    expect(line.sessionsPerWeek).toBeUndefined();
    expect(line.sessionFrequencyCustom).toBeUndefined();
  });

  it("trims custom cadence and removes numeric cadence fields", () => {
    const line: TrainerServiceOfferingLine = {
      ...baseOfferingLine(),
      sessionFrequencyCount: 4,
      sessionsPerWeek: 4,
    };
    mergeServiceOfferingFrequencyFields(line, {
      sessionFrequencyKind: "custom",
      sessionFrequencyCustom: "  Every other Saturday  ",
    });

    expect(line.sessionFrequencyKind).toBe("custom");
    expect(line.sessionFrequencyCustom).toBe("Every other Saturday");
    expect(line.sessionFrequencyCount).toBeUndefined();
    expect(line.sessionsPerWeek).toBeUndefined();
  });

  it("backfills missing legacy variation sessionCount during parse", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      services: [
        {
          serviceId: "one_on_one_pt",
          delivery: "virtual",
          billingUnit: "per_session",
          priceUsd: 150,
          variations: [
            {
              variationId: "starter",
              label: "Starter Package",
              billingUnit: "per_session",
              priceUsd: 150,
              sessionMinutes: 60,
            },
          ],
        },
      ],
    });

    const parsed = parseTrainerServiceOfferingsJson(raw);
    expect(parsed.services[0]?.variations?.[0]?.sessionCount).toBe(1);
  });

  it("falls back to an empty default document for invalid JSON", () => {
    const parsed = parseTrainerServiceOfferingsJson("{bad json");
    expect(parsed).toEqual({
      schemaVersion: 1,
      services: [],
      inPersonServiceZip: null,
      inPersonServiceRadiusMiles: null,
    });
  });

  it("resolves selected variation and bundle-tier checkout SKU", () => {
    const line: TrainerServiceOfferingLine = {
      ...baseOfferingLine(),
      variations: [
        {
          variationId: "v-basic",
          label: "Basic",
          billingUnit: "per_session",
          priceUsd: 120,
          sessionCount: 1,
          sessionMinutes: 60,
          bundleTiers: [{ tierId: "t3", quantity: 3, priceUsd: 330 }],
        },
      ],
    };

    const hit = resolveServiceCheckoutSku(line, "v-basic", "t3");
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.sku.checkoutKey).toBe("one_on_one_pt:v-basic:t3");
      expect(hit.sku.bundleQuantity).toBe(3);
    }
  });

  it("returns an error when requested checkout option does not exist", () => {
    const line: TrainerServiceOfferingLine = {
      ...baseOfferingLine(),
      variations: [
        {
          variationId: "v-basic",
          label: "Basic",
          billingUnit: "per_session",
          priceUsd: 120,
          sessionCount: 1,
          sessionMinutes: 60,
        },
      ],
    };

    expect(resolveServiceCheckoutSku(line, null, null)).toEqual({
      ok: false,
      error: "Invalid package selection.",
    });
    expect(resolveServiceCheckoutSku(line, "v-missing", null)).toEqual({
      ok: false,
      error: "That package option is not available.",
    });
  });

  it("filters hidden/unavailable services and adds add-on copy once", () => {
    const doc: TrainerServiceOfferingsDocument = {
      schemaVersion: 1,
      inPersonServiceZip: null,
      inPersonServiceRadiusMiles: null,
      services: [
        {
          ...baseOfferingLine(),
          bundleTiers: [{ tierId: "pack-3", quantity: 3, priceUsd: 330 }],
          optionalAddOns: [
            {
              addonId: "mobility",
              label: "Mobility add-on",
              priceUsd: 25,
              billingUnit: "per_session",
              description: "Extra cooldown drills",
            },
          ],
        },
        {
          ...baseOfferingLine(),
          serviceId: "sports_specific",
          siteVisibility: "hidden",
        },
        {
          ...baseOfferingLine(),
          serviceId: "hiit_conditioning",
          clientBookingAvailability: "unavailable",
        },
      ],
    };

    const skus = publicBrowseableSkuSummaries(doc);
    expect(skus).toHaveLength(2);
    expect(new Set(skus.map((s) => s.serviceId))).toEqual(new Set(["one_on_one_pt"]));
    expect(skus[0]?.label).toContain("Optional add-ons:");
    expect(skus[0]?.label).toContain("Mobility add-on");
    expect(skus[1]?.label).not.toContain("Optional add-ons:");
  });
});
