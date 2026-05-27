import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCountLaunchClients,
  mockGetClientFoundingTrialDays,
  mockGetClientFoundingTrialMaxClients,
  mockGetClientPostCapTrialDays,
  mockResolveClientSubscriptionBilling,
} = vi.hoisted(() => ({
  mockCountLaunchClients: vi.fn(),
  mockGetClientFoundingTrialDays: vi.fn(),
  mockGetClientFoundingTrialMaxClients: vi.fn(),
  mockGetClientPostCapTrialDays: vi.fn(),
  mockResolveClientSubscriptionBilling: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClients: mockCountLaunchClients,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getClientFoundingTrialDays: mockGetClientFoundingTrialDays,
  getClientFoundingTrialMaxClients: mockGetClientFoundingTrialMaxClients,
  getClientPostCapTrialDays: mockGetClientPostCapTrialDays,
  resolveClientSubscriptionBilling: mockResolveClientSubscriptionBilling,
}));

import { GET, dynamic } from "@/app/api/client/billing/subscription-offer/route";

describe("GET /api/client/billing/subscription-offer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountLaunchClients.mockResolvedValue(12);
    mockGetClientFoundingTrialDays.mockReturnValue(30);
    mockGetClientFoundingTrialMaxClients.mockReturnValue(15);
    mockGetClientPostCapTrialDays.mockReturnValue(3);
    mockResolveClientSubscriptionBilling.mockResolvedValue({
      foundingSlot: true,
      trialDays: 30,
      choice: "trial",
    });
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns founding-slot details and disables pay-now options", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockResolveClientSubscriptionBilling).toHaveBeenCalledWith({});
    expect(body).toEqual({
      foundingSlot: true,
      trialDays: 30,
      choice: "trial",
      requiresCardFirst: true,
      monthlyUsd: 10,
      foundingTrialDays: 30,
      postCapTrialDays: 3,
      foundingCap: 15,
      launchClientCount: 12,
      foundingSlotsRemaining: 3,
      allowPayNow: false,
      allowTrial3d: false,
    });
  });

  it("clamps remaining slots at zero and enables pay options outside founding slots", async () => {
    mockResolveClientSubscriptionBilling.mockResolvedValueOnce({
      foundingSlot: false,
      trialDays: 3,
      choice: "pay_now",
    });
    mockGetClientFoundingTrialMaxClients.mockReturnValueOnce(10);
    mockCountLaunchClients.mockResolvedValueOnce(18);

    const response = await GET();
    const body = await response.json();

    expect(body.foundingSlotsRemaining).toBe(0);
    expect(body.allowPayNow).toBe(true);
    expect(body.allowTrial3d).toBe(true);
    expect(body.foundingSlot).toBe(false);
    expect(body.trialDays).toBe(3);
    expect(body.choice).toBe("pay_now");
  });
});
