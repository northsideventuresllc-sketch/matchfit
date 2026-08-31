import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyTurnstileTokenMock,
  sendSupabaseSignupVerificationEmailMock,
  checkEmailAlreadyConfirmedMock,
} = vi.hoisted(() => ({
  verifyTurnstileTokenMock: vi.fn(),
  sendSupabaseSignupVerificationEmailMock: vi.fn(),
  checkEmailAlreadyConfirmedMock: vi.fn(),
}));

vi.mock("@/lib/turnstile-verify", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

vi.mock("@/lib/supabase-signup-verification-email", () => ({
  sendSupabaseSignupVerificationEmail: sendSupabaseSignupVerificationEmailMock,
  checkEmailAlreadyConfirmed: checkEmailAlreadyConfirmedMock,
  EMAIL_ALREADY_CONFIRMED_MESSAGE:
    "This email is already verified. Use Continue with password below, or sign in.",
}));

import { POST } from "@/app/api/public/resend-signup-verification/route";

describe("POST /api/public/resend-signup-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkEmailAlreadyConfirmedMock.mockResolvedValue(false);
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    sendSupabaseSignupVerificationEmailMock.mockResolvedValue({ ok: true, resendId: "email_123" });
  });

  it("sends trainer verification email when turnstile passes", async () => {
    const res = await POST(
      new Request("https://match-fit.net/api/public/resend-signup-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "coach@example.com",
          password: "TestPass1!",
          role: "trainer",
          firstName: "Jon",
          turnstileToken: "token",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendSupabaseSignupVerificationEmailMock).toHaveBeenCalledWith({
      email: "coach@example.com",
      password: "TestPass1!",
      role: "trainer",
      firstName: "Jon",
    });
  });

  it("rejects invalid email", async () => {
    const res = await POST(
      new Request("https://match-fit.net/api/public/resend-signup-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          role: "trainer",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns EMAIL_ALREADY_CONFIRMED without spending the Turnstile token", async () => {
    checkEmailAlreadyConfirmedMock.mockResolvedValue(true);

    const res = await POST(
      new Request("https://match-fit.net/api/public/resend-signup-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "coach@example.com",
          password: "TestPass1!",
          role: "trainer",
          firstName: "Jon",
          turnstileToken: "already-used-token",
        }),
      }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "This email is already verified. Use Continue with password below, or sign in.",
      code: "EMAIL_ALREADY_CONFIRMED",
    });
    // The token must stay unspent here so the client's follow-up call to
    // complete-supabase-signup (which reuses it) doesn't get rejected as a duplicate.
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
    expect(sendSupabaseSignupVerificationEmailMock).not.toHaveBeenCalled();
  });
});
