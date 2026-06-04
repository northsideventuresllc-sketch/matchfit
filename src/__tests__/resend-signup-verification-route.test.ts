import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyTurnstileTokenMock,
  sendSupabaseSignupVerificationEmailMock,
} = vi.hoisted(() => ({
  verifyTurnstileTokenMock: vi.fn(),
  sendSupabaseSignupVerificationEmailMock: vi.fn(),
}));

vi.mock("@/lib/turnstile-verify", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

vi.mock("@/lib/supabase-signup-verification-email", () => ({
  sendSupabaseSignupVerificationEmail: sendSupabaseSignupVerificationEmailMock,
}));

import { POST } from "@/app/api/public/resend-signup-verification/route";

describe("POST /api/public/resend-signup-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
