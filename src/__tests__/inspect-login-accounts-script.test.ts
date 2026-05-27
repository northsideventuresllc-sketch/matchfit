import { describe, expect, it } from "vitest";
import {
  buildLookupOrFilters,
  normalizeAdminCode,
  normalizeLoginIdentifier,
} from "../../scripts/inspect-login-accounts";

describe("inspect-login-accounts script helpers", () => {
  describe("normalizeAdminCode", () => {
    it("trims and lowercases admin codes", () => {
      expect(normalizeAdminCode("  JoBo0602  ")).toBe("jobo0602");
    });
  });

  describe("normalizeLoginIdentifier", () => {
    it("returns email when identifier is an email address", () => {
      expect(normalizeLoginIdentifier("  User@Example.com  ")).toEqual({
        email: "user@example.com",
      });
    });

    it("returns phone when identifier is mostly digits", () => {
      expect(normalizeLoginIdentifier(" (404) 555-0100 ")).toEqual({
        phone: "(404) 555-0100",
      });
    });

    it("strips leading @ and returns username for handles", () => {
      expect(normalizeLoginIdentifier("  @Coach_Name  ")).toEqual({
        username: "Coach_Name",
      });
    });

    it("returns empty object for blank values", () => {
      expect(normalizeLoginIdentifier("   ")).toEqual({});
    });
  });

  describe("buildLookupOrFilters", () => {
    it("builds a case-insensitive username OR filter", () => {
      expect(buildLookupOrFilters("Coach_Name")).toEqual([
        { username: { equals: "Coach_Name", mode: "insensitive" } },
      ]);
    });

    it("builds an email OR filter", () => {
      expect(buildLookupOrFilters("User@Example.com")).toEqual([{ email: "user@example.com" }]);
    });

    it("builds a phone OR filter", () => {
      expect(buildLookupOrFilters("+1 (404) 555-0100")).toEqual([{ phone: "+1 (404) 555-0100" }]);
    });

    it("returns no filters for blank input", () => {
      expect(buildLookupOrFilters("   ")).toEqual([]);
    });
  });
});
