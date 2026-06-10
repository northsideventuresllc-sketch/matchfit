import { describe, expect, it } from "vitest";
import { assessEmailLeadContact, normalizeEmailAddress } from "@/lib/outreach-email-verify";

describe("outreach email verify", () => {
  it("normalizes valid trainer emails", () => {
    expect(normalizeEmailAddress(" Coach@Example.com ")).toBe("coach@example.com");
  });

  it("rejects invalid email formats", () => {
    expect(assessEmailLeadContact("not-an-email")).toEqual({
      ok: false,
      reason: "Invalid email address format.",
    });
  });

  it("accepts business trainer emails", () => {
    expect(assessEmailLeadContact("hello@atlfitcoach.com")).toEqual({
      ok: true,
      email: "hello@atlfitcoach.com",
    });
  });
});
