import { describe, expect, it } from "vitest";
import { clientZipToPrefix } from "@/lib/featured-region";
import {
  COUNTRY_OPTIONS,
  isValidCountryCode,
  LOCATION_SCOPE_LABELS,
  LOCATION_SCOPES,
  locationScopeMatch,
  locationScopeSchema,
  normalizePostalCode,
  postalRegionPrefix,
  type UserLocation,
} from "@/lib/user-location";

describe("COUNTRY_OPTIONS / isValidCountryCode", () => {
  it("contains the full ISO 3166-1 alpha-2 list with unique two-letter codes and labels", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThanOrEqual(240);
    const codes = COUNTRY_OPTIONS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const { code, label } of COUNTRY_OPTIONS) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes key markets", () => {
    for (const code of ["US", "CA", "GB", "AU", "DE", "BR", "JP", "IN", "ZA", "GE"]) {
      expect(isValidCountryCode(code)).toBe(true);
    }
  });

  it("accepts case-insensitive/trimmed input and rejects unknowns", () => {
    expect(isValidCountryCode("us")).toBe(true);
    expect(isValidCountryCode(" gb ")).toBe(true);
    expect(isValidCountryCode("XX")).toBe(false);
    expect(isValidCountryCode("USA")).toBe(false);
    expect(isValidCountryCode("")).toBe(false);
  });
});

describe("normalizePostalCode", () => {
  it("trims, collapses inner whitespace, and uppercases", () => {
    expect(normalizePostalCode("GB", "  sw1a   1aa ")).toBe("SW1A 1AA");
    expect(normalizePostalCode("CA", "k1a 0b1")).toBe("K1A 0B1");
    expect(normalizePostalCode("US", " 30309 ")).toBe("30309");
  });

  it("returns null when empty", () => {
    expect(normalizePostalCode("US", "")).toBeNull();
    expect(normalizePostalCode("US", "   ")).toBeNull();
    expect(normalizePostalCode("US", null)).toBeNull();
    expect(normalizePostalCode("US", undefined)).toBeNull();
  });

  it("returns null when longer than 20 chars", () => {
    expect(normalizePostalCode("US", "1234567890123456789012345")).toBeNull();
    expect(normalizePostalCode("US", "A".repeat(20))).toBe("A".repeat(20));
  });

  it("never strips non-digits", () => {
    expect(normalizePostalCode("GB", "SW1A 1AA")).toBe("SW1A 1AA");
    expect(normalizePostalCode(null, "75-008")).toBe("75-008");
  });
});

describe("postalRegionPrefix — US parity with featured-region clientZipToPrefix", () => {
  const US_ZIP_SAMPLES = [
    "30309",
    "30309-1234",
    "03060",
    "00501",
    "  30309  ",
    "303",
    "30",
    "3",
    "",
    "   ",
    "abcde",
    "3a0b3c0d9",
    "zip 30309",
    "30-309",
    "99999",
    "12345-6789",
    "1 2 3",
    "12",
    null,
    undefined,
  ] as const;

  it("is byte-identical to clientZipToPrefix for every US sample", () => {
    for (const zip of US_ZIP_SAMPLES) {
      expect(postalRegionPrefix("US", zip)).toStrictEqual(clientZipToPrefix(zip));
    }
  });

  it("keeps leading zeros exactly as the legacy prefix does", () => {
    expect(postalRegionPrefix("US", "03060")).toBe(clientZipToPrefix("03060"));
    expect(postalRegionPrefix("US", "03060")).toBe("030");
    expect(postalRegionPrefix("US", "00501")).toBe("005");
  });
});

describe("postalRegionPrefix — non-US", () => {
  it("CA: first three alphanumerics (FSA)", () => {
    expect(postalRegionPrefix("CA", "K1A 0B1")).toBe("K1A");
    expect(postalRegionPrefix("CA", "k1a0b1")).toBe("K1A");
    expect(postalRegionPrefix("CA", "K1")).toBeNull();
  });

  it("GB: outward code", () => {
    expect(postalRegionPrefix("GB", "SW1A 1AA")).toBe("SW1A");
    expect(postalRegionPrefix("GB", "sw1a1aa")).toBe("SW1A");
    expect(postalRegionPrefix("GB", "EC1A 1BB")).toBe("EC1A");
    expect(postalRegionPrefix("GB", "M1 1AE")).toBe("M1");
    expect(postalRegionPrefix("GB", "m11ae")).toBe("M1");
  });

  it("default: first three alphanumerics or null", () => {
    expect(postalRegionPrefix("DE", "10115")).toBe("101");
    expect(postalRegionPrefix("NL", "1012 AB")).toBe("101");
    expect(postalRegionPrefix("BR", "01310-100")).toBe("013");
    expect(postalRegionPrefix("DE", "1")).toBeNull();
    expect(postalRegionPrefix("DE", "")).toBeNull();
    expect(postalRegionPrefix("DE", null)).toBeNull();
  });
});

describe("location scopes", () => {
  it("exposes the three stops with worldwide semantics and sentence-case labels", () => {
    expect(LOCATION_SCOPES).toStrictEqual(["near_me", "my_country", "worldwide"]);
    expect(locationScopeSchema.parse("worldwide")).toBe("worldwide");
    expect(() => locationScopeSchema.parse("nearby")).toThrow();
    expect(LOCATION_SCOPE_LABELS).toStrictEqual({
      near_me: "Near me",
      my_country: "My country",
      worldwide: "Worldwide",
    });
  });
});

describe("locationScopeMatch", () => {
  const usAtl: UserLocation = { countryCode: "US", postalCode: "30309" };
  const usAtl2: UserLocation = { countryCode: "US", postalCode: "30363" };
  const usNyc: UserLocation = { countryCode: "US", postalCode: "10001" };
  const gb: UserLocation = { countryCode: "GB", postalCode: "SW1A 1AA" };
  const unknown: UserLocation = { countryCode: null, postalCode: null };
  const usNoPostal: UserLocation = { countryCode: "US", postalCode: null };

  it("worldwide always matches", () => {
    expect(locationScopeMatch("worldwide", usAtl, gb)).toBe(true);
    expect(locationScopeMatch("worldwide", unknown, unknown)).toBe(true);
  });

  it("my_country requires the same known country", () => {
    expect(locationScopeMatch("my_country", usAtl, usNyc)).toBe(true);
    expect(locationScopeMatch("my_country", usAtl, gb)).toBe(false);
    expect(locationScopeMatch("my_country", usAtl, unknown)).toBe(false);
    expect(locationScopeMatch("my_country", unknown, usAtl)).toBe(false);
  });

  it("near_me requires the same country and postal region prefix", () => {
    expect(locationScopeMatch("near_me", usAtl, usAtl2)).toBe(true); // both 303
    expect(locationScopeMatch("near_me", usAtl, usNyc)).toBe(false); // 303 vs 100
    expect(locationScopeMatch("near_me", usAtl, gb)).toBe(false);
    expect(locationScopeMatch("near_me", usAtl, unknown)).toBe(false);
  });

  it("near_me degrades to same-country when either side has no postal", () => {
    expect(locationScopeMatch("near_me", usAtl, usNoPostal)).toBe(true);
    expect(locationScopeMatch("near_me", usNoPostal, usAtl)).toBe(true);
    expect(locationScopeMatch("near_me", usNoPostal, gb)).toBe(false);
  });
});
