import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  createSupabaseAdminClientMock,
  sendMatchFitBrandedEmailMock,
  adminAuthMock,
} = vi.hoisted(() => {
  const adminAuthMock = {
    createUser: vi.fn(),
    updateUserById: vi.fn(),
    generateLink: vi.fn(),
  };
  return {
    prismaMock: { $queryRaw: vi.fn() },
    createSupabaseAdminClientMock: vi.fn(() => ({ auth: { admin: adminAuthMock } })),
    sendMatchFitBrandedEmailMock: vi.fn(),
    adminAuthMock,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase/admin-client", () => ({
  isSupabaseAdminConfigured: () => true,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));
vi.mock("@/lib/match-fit-branded-email", () => ({
  sendMatchFitBrandedEmail: sendMatchFitBrandedEmailMock,
}));

import { sendSupabaseSignupVerificationEmail } from "@/lib/supabase-signup-verification-email";

describe("sendSupabaseSignupVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    prismaMock.$queryRaw.mockResolvedValue([]);
    adminAuthMock.createUser.mockResolvedValue({ data: { user: { id: "user_1" } }, error: null });
    adminAuthMock.generateLink.mockResolvedValue({
      data: { properties: { action_link: "https://example.com/confirm" } },
      error: null,
    });
    adminAuthMock.updateUserById.mockResolvedValue({ error: null });
    sendMatchFitBrandedEmailMock.mockResolvedValue("email_1");
  });

  it("creates auth user and sends magic link via Resend without client signUp", async () => {
    const result = await sendSupabaseSignupVerificationEmail({
      email: "coach@example.com",
      password: "TestPass1!",
      role: "trainer",
      firstName: "Jon",
    });

    expect(result).toEqual({ ok: true, resendId: "email_1" });
    expect(adminAuthMock.createUser).toHaveBeenCalledOnce();
    expect(adminAuthMock.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "magiclink", email: "coach@example.com" }),
    );
    expect(sendMatchFitBrandedEmailMock).toHaveBeenCalledOnce();
  });

  it("maps Supabase email rate limit errors", async () => {
    adminAuthMock.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Email rate limit exceeded", status: 429 },
    });

    const result = await sendSupabaseSignupVerificationEmail({
      email: "coach@example.com",
      password: "TestPass1!",
      role: "trainer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_RATE_LIMIT");
    }
  });
});
