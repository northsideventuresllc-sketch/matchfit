import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeInstagramHandle,
  normalizeInstagramProfileUrl,
} from "@/lib/outreach-exclusions";

describe("outreach exclusions", () => {
  it("normalizes instagram handles and profile urls", () => {
    expect(normalizeInstagramHandle("@CoachATL")).toBe("@coachatl");
    expect(normalizeInstagramHandle("https://instagram.com/Coach.ATL/")).toBe("@coach.atl");
    expect(normalizeInstagramProfileUrl("@coachatl", "https://instagram.com/CoachATL?hl=en")).toBe(
      "https://instagram.com/CoachATL",
    );
  });

  it("rejects invalid handles and emails", () => {
    expect(normalizeInstagramHandle("unknown")).toBeNull();
    expect(normalizeInstagramHandle("")).toBeNull();
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("Coach@Gym.com")).toBe("coach@gym.com");
  });
});
