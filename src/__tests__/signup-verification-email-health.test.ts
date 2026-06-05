import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/signup-verification-email-health/route";

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

describe("GET /api/public/signup-verification-email-health", () => {
  it("returns delivery configuration status", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      resendConfigured: boolean;
      supabaseAdminConfigured: boolean;
      deliveryConfigured: boolean;
      message: string;
    };
    expect(typeof body.resendConfigured).toBe("boolean");
    expect(typeof body.supabaseAdminConfigured).toBe("boolean");
    expect(typeof body.deliveryConfigured).toBe("boolean");
    expect(typeof body.message).toBe("string");
  });
});
