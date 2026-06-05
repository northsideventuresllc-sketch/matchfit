import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    clientTwoFactorChannel: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";

describe("getLoginOtpDelivery", () => {
  beforeEach(() => {
    vi.mocked(prisma.clientTwoFactorChannel.findFirst).mockResolvedValue(null);
  });

  it("falls back to account email when 2FA is enabled without a verified channel", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      email: "User@Test.COM",
      phone: "+15551234567",
      twoFactorEnabled: true,
      twoFactorMethod: "NONE",
    } as never);

    const delivery = await getLoginOtpDelivery("client_1");
    expect(delivery).toEqual({
      delivery: "EMAIL",
      email: "user@test.com",
      phone: "+15551234567",
    });
  });
});
