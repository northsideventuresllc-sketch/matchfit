import { describe, expect, it } from "vitest";
import { resolveTrainerBackgroundCheckJurisdiction } from "@/lib/trainer-background-check-jurisdiction";
import { lookupUsStateFromZip } from "@/lib/us-zip-to-state";

describe("lookupUsStateFromZip", () => {
  it("maps Atlanta metro ZIPs to GA", () => {
    expect(lookupUsStateFromZip("30301")).toBe("GA");
  });

  it("maps nationwide virtual coach ZIPs to their states", () => {
    expect(lookupUsStateFromZip("90210")).toBe("CA");
    expect(lookupUsStateFromZip("78701")).toBe("TX");
    expect(lookupUsStateFromZip("10001")).toBe("NY");
  });
});

describe("resolveTrainerBackgroundCheckJurisdiction", () => {
  it("uses signup service ZIP state for virtual-only coaches", () => {
    const result = resolveTrainerBackgroundCheckJurisdiction({
      serviceZipCode: "90210",
      betaSlotInPersonHeld: false,
    });
    expect(result).toEqual({
      state: "CA",
      zip: "90210",
      source: "service_zip",
    });
  });

  it("does not default virtual coaches to GA when they live outside Atlanta", () => {
    const result = resolveTrainerBackgroundCheckJurisdiction({
      serviceZipCode: "80202",
      betaSlotInPersonHeld: false,
    });
    expect(result).toEqual({
      state: "CO",
      zip: "80202",
      source: "service_zip",
    });
  });

  it("uses W-9 state when available", () => {
    const result = resolveTrainerBackgroundCheckJurisdiction({
      serviceZipCode: "30301",
      w9Json: JSON.stringify({
        state: "GA",
        zip: "30308",
        city: "Atlanta",
      }),
      betaSlotInPersonHeld: true,
    });
    expect(result).toEqual({
      state: "GA",
      zip: "30308",
      city: "Atlanta",
      source: "w9",
    });
  });

  it("rejects mismatched W-9 state and ZIP", () => {
    const result = resolveTrainerBackgroundCheckJurisdiction({
      serviceZipCode: "90210",
      w9Json: JSON.stringify({ state: "GA", zip: "90210" }),
    });
    expect(result).toEqual({
      error: "Your W-9 state does not match your ZIP code. Update your W-9 before continuing.",
    });
  });
});
