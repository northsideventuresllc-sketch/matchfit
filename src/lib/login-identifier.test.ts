import { describe, expect, it } from "vitest";
import { normalizeLoginIdentifier } from "@/lib/login-identifier";

describe("normalizeLoginIdentifier", () => {
  it("lowercases email and ignores leading @", () => {
    expect(normalizeLoginIdentifier("User@Example.COM")).toEqual({ email: "user@example.com" });
    expect(normalizeLoginIdentifier("@coach_handle")).toEqual({ username: "coach_handle" });
  });

  it("treats long digit strings as phone", () => {
    expect(normalizeLoginIdentifier("(404) 555-0100")).toEqual({ phone: "(404) 555-0100" });
  });

  it("returns username for plain handles", () => {
    expect(normalizeLoginIdentifier("MyCoach99")).toEqual({ username: "MyCoach99" });
  });
});
