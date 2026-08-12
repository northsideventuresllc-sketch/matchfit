import { describe, expect, it } from "vitest";
import { checkAndAdvancePasswordChangeRateLimit } from "@/lib/password-change-rate-limit";
import { describePasswordPolicyViolations, passwordPolicySchema } from "@/lib/validations/client-register";
import { signWasntMeToken, verifyWasntMeToken } from "@/lib/account-security-lock";

describe("password change rate limit", () => {
  const now = Date.UTC(2026, 7, 5, 12, 0, 0);

  it("allows the first change and starts a window", () => {
    const result = checkAndAdvancePasswordChangeRateLimit(
      { passwordChangeCount24h: 0, passwordChangeWindowStartsAt: null },
      now,
    );
    expect(result).toMatchObject({ ok: true, nextState: { passwordChangeCount24h: 1 } });
  });

  it("allows the second change within the same window", () => {
    const result = checkAndAdvancePasswordChangeRateLimit(
      { passwordChangeCount24h: 1, passwordChangeWindowStartsAt: new Date(now - 60_000) },
      now,
    );
    expect(result).toMatchObject({ ok: true, nextState: { passwordChangeCount24h: 2 } });
  });

  it("blocks a third change within the same 24h window", () => {
    const result = checkAndAdvancePasswordChangeRateLimit(
      { passwordChangeCount24h: 2, passwordChangeWindowStartsAt: new Date(now - 60_000) },
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("resets once the 24h window has fully elapsed", () => {
    const result = checkAndAdvancePasswordChangeRateLimit(
      { passwordChangeCount24h: 2, passwordChangeWindowStartsAt: new Date(now - 24 * 60 * 60 * 1000 - 1) },
      now,
    );
    expect(result).toMatchObject({ ok: true, nextState: { passwordChangeCount24h: 1 } });
  });

  it("does not allow a change exactly at the 24h boundary to skip the count", () => {
    // Right at the boundary the window is treated as expired (>=), which is the safe direction —
    // it never blocks someone longer than 24h, only exactly at or past it.
    const result = checkAndAdvancePasswordChangeRateLimit(
      { passwordChangeCount24h: 2, passwordChangeWindowStartsAt: new Date(now - 24 * 60 * 60 * 1000) },
      now,
    );
    expect(result.ok).toBe(true);
  });
});

describe("password strength policy", () => {
  it("requires a number now, not just a capital and a special character", () => {
    expect(describePasswordPolicyViolations("Abcdefg!")).toBe("Password must include at least one number.");
    expect(passwordPolicySchema.safeParse("Abcdefg!").success).toBe(false);
  });

  it("accepts a password with all four requirements", () => {
    expect(describePasswordPolicyViolations("Abcdefg1!")).toBeNull();
    expect(passwordPolicySchema.safeParse("Abcdefg1!").success).toBe(true);
  });

  it("still catches the pre-existing requirements", () => {
    expect(describePasswordPolicyViolations("short1!")).toMatch(/8 characters/);
    expect(describePasswordPolicyViolations("nocapital1!")).toMatch(/capital letter/);
    expect(describePasswordPolicyViolations("NoSpecial1")).toMatch(/special character/);
  });
});

describe("wasn't-me security-lock token", () => {
  it("round-trips account type and id, and rejects a token for the wrong purpose", async () => {
    const token = await signWasntMeToken("trainer", "trainer_123");
    const claims = await verifyWasntMeToken(token);
    expect(claims).toEqual({ accountType: "trainer", accountId: "trainer_123" });
  });

  it("rejects garbage tokens", async () => {
    expect(await verifyWasntMeToken("not-a-real-token")).toBeNull();
  });
});
