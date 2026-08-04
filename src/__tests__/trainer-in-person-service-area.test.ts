import { describe, expect, it } from "vitest";
import {
  inPersonServiceZipValidationError,
  isValidServicePostalCode,
  zipSupportsTrainerInPersonServices,
} from "@/lib/trainer-in-person-service-area";

/**
 * MF-ATLANTA-GATES-AFTER-WORLDWIDE (2026-08-04): there is no metro allow-list.
 * These tests exist to keep it that way — a coach's in-person service area is
 * whatever postal code they supply, in any country.
 */
describe("trainer in-person service area", () => {
  it("accepts a service postal code from anywhere in the world", () => {
    expect(isValidServicePostalCode("94102")).toBe(true);
    expect(isValidServicePostalCode("30301")).toBe(true);
    expect(isValidServicePostalCode("SW1A 1AA")).toBe(true);
    expect(isValidServicePostalCode("M5V 3L9")).toBe(true);
    expect(isValidServicePostalCode("2000")).toBe(true);
  });

  it("rejects only unusable values, never a location", () => {
    expect(isValidServicePostalCode("")).toBe(false);
    expect(isValidServicePostalCode(null)).toBe(false);
    expect(isValidServicePostalCode("  ")).toBe(false);
    expect(isValidServicePostalCode("x")).toBe(false);
  });

  it("supports in-person coaching outside any single metro", () => {
    expect(zipSupportsTrainerInPersonServices("30301")).toBe(true);
    expect(zipSupportsTrainerInPersonServices("94102")).toBe(true);
    expect(zipSupportsTrainerInPersonServices("SW1A 1AA")).toBe(true);
  });

  it("never returns a geography-based validation error", () => {
    expect(inPersonServiceZipValidationError("94102")).toBeNull();
    expect(inPersonServiceZipValidationError("SW1A 1AA")).toBeNull();
    expect(inPersonServiceZipValidationError("")).not.toBeNull();
    expect(inPersonServiceZipValidationError("")).not.toMatch(/atlanta/i);
  });
});
