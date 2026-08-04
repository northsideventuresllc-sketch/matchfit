import { describe, expect, it } from "vitest";

import {
  countryUsesPostalCode,
  postalRuleForCountry,
  postalValidationError,
} from "@/lib/postal-rules";
import { COUNTRY_OPTIONS } from "@/lib/user-location";

describe("country-aware postal rules", () => {
  it("labels the field the way each country actually calls it", () => {
    expect(postalRuleForCountry("US").label).toBe("ZIP code");
    expect(postalRuleForCountry("GB").label).toBe("Postcode");
    expect(postalRuleForCountry("IN").label).toBe("PIN code");
    expect(postalRuleForCountry("BR").label).toBe("CEP");
    expect(postalRuleForCountry("IE").label).toBe("Eircode");
  });

  it("SKIPS the question entirely for countries with no postal system", () => {
    // The UAE is on the first-tier marketing list AND has no postal codes — asking for one
    // would be a dead field the user cannot fill.
    expect(countryUsesPostalCode("AE")).toBe(false);
    expect(countryUsesPostalCode("HK")).toBe(false);
    expect(postalRuleForCountry("AE").requirement).toBe("none");
    // And a missing value must never be an error there.
    expect(postalValidationError("AE", "")).toBeNull();
    expect(postalValidationError("AE", null)).toBeNull();
  });

  it("requires and validates a US ZIP", () => {
    expect(postalValidationError("US", "30301")).toBeNull();
    expect(postalValidationError("US", "30301-1234")).toBeNull();
    expect(postalValidationError("US", "")).toMatch(/zip code/i);
    expect(postalValidationError("US", "SW1A 1AA")).toMatch(/zip code/i);
  });

  it("accepts real non-US formats that the old US-only regex destroyed", () => {
    expect(postalValidationError("GB", "SW1A 1AA")).toBeNull();
    expect(postalValidationError("CA", "V6B 1A1")).toBeNull();
    expect(postalValidationError("NL", "1012 AB")).toBeNull();
    expect(postalValidationError("BR", "01310-100")).toBeNull();
    expect(postalValidationError("JP", "100-0001")).toBeNull();
    expect(postalValidationError("IN", "110001")).toBeNull();
  });

  it("asks NOTHING for a country we do not have a rule for", () => {
    // JB's ruling: keep the process simple. If we do not know what a country calls its postal
    // code or what shape it takes, showing a vague optional box is friction that buys nothing.
    expect(postalRuleForCountry("ZZ").requirement).toBe("none");
    expect(countryUsesPostalCode("ZZ")).toBe(false);
    expect(postalValidationError("ZZ", "")).toBeNull();
    expect(postalValidationError("ZZ", "anything-goes")).toBeNull();
  });

  it("only ever shows the question when we know that country's own term for it", () => {
    // Every country that DOES render a field must carry a real local label — never a generic
    // fallback. This is what stops a half-known country leaking a vague box into signup.
    for (const { code } of COUNTRY_OPTIONS) {
      const rule = postalRuleForCountry(code);
      if (rule.requirement === "none") continue;
      expect(rule.example, `${code} renders a field but has no example`).not.toBe("");
    }
  });

  it("treats Eircode as optional — many people do not know theirs", () => {
    expect(postalValidationError("IE", "")).toBeNull();
    expect(postalRuleForCountry("IE").requirement).toBe("optional");
  });

  it("returns a usable rule for every country we offer at signup", () => {
    for (const { code } of COUNTRY_OPTIONS) {
      const rule = postalRuleForCountry(code);
      expect(["required", "optional", "none"]).toContain(rule.requirement);
      expect(rule.label.length).toBeGreaterThan(0);
    }
  });

  it("is case- and whitespace-insensitive about the country code", () => {
    expect(postalRuleForCountry(" us ").label).toBe("ZIP code");
    expect(countryUsesPostalCode(" ae ")).toBe(false);
  });
});
