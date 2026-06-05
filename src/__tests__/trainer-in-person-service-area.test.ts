import { describe, expect, it } from "vitest";
import {
  inPersonServiceZipValidationError,
  isValidUsServiceZip,
  zipSupportsTrainerInPersonServices,
} from "@/lib/trainer-in-person-service-area";

describe("trainer in-person service area", () => {
  it("accepts any valid US ZIP for signup validation", () => {
    expect(isValidUsServiceZip("94102")).toBe(true);
    expect(isValidUsServiceZip("30301")).toBe(true);
  });

  it("limits in-person services to Atlanta metro during beta", () => {
    expect(zipSupportsTrainerInPersonServices("30301")).toBe(true);
    expect(zipSupportsTrainerInPersonServices("94102")).toBe(false);
    expect(inPersonServiceZipValidationError("94102")).toMatch(/Atlanta metro/i);
  });
});
