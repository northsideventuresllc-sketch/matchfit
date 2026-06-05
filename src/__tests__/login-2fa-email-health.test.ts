import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/login-2fa-email-health/route";

vi.mock("@/lib/resend-email-health", () => ({
  resendEmailHealth: vi.fn(async () => ({
    configured: true,
    apiReachable: true,
    fromAddress: "Match Fit <noreply@example.test>",
    domainVerified: true,
    loadedFromPlatformSecrets: true,
    error: null,
  })),
}));

describe("GET /api/public/login-2fa-email-health", () => {
  it("returns healthy when Resend probe succeeds", async () => {
    const res = await GET();
    const body = (await res.json()) as { healthy: boolean; message: string };
    expect(body.healthy).toBe(true);
    expect(body.message).toContain("OTP emails are ready");
  });
});
