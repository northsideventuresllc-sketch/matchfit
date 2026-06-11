import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isTrainerVisibleInClientDiscoveryMock,
  isTrainerBookableForClientsMock,
  trainerBookableBlockedMessageMock,
  trainerVerificationBadgeForClientMock,
  getSessionClientIdMock,
  prismaTrainerFindUniqueMock,
} = vi.hoisted(() => ({
  isTrainerVisibleInClientDiscoveryMock: vi.fn(),
  isTrainerBookableForClientsMock: vi.fn(),
  trainerBookableBlockedMessageMock: vi.fn(),
  trainerVerificationBadgeForClientMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  prismaTrainerFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/trainer-client-discovery", () => ({
  isTrainerVisibleInClientDiscovery: isTrainerVisibleInClientDiscoveryMock,
  isTrainerBookableForClients: isTrainerBookableForClientsMock,
  trainerBookableBlockedMessage: trainerBookableBlockedMessageMock,
  trainerVerificationBadgeForClient: trainerVerificationBadgeForClientMock,
  TRAINER_VERIFICATION_IN_PROGRESS_CLIENT_MESSAGE:
    "This coach is finishing verification. You can chat now — booking unlocks when they're verified.",
}));

vi.mock("@/lib/coach-service-checkout-policy", () => ({
  evaluateCoachServiceCheckoutPolicy: vi.fn(),
}));

vi.mock("@/lib/stripe-trainer-service-sale-checkout", () => ({
  createTrainerServiceSaleStripeCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/user-block-queries", () => ({
  isTrainerClientInteractionRestricted: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: prismaTrainerFindUniqueMock },
    trainerClientConversation: { findUnique: vi.fn() },
    client: {
      findUnique: vi.fn().mockResolvedValue({
        id: "client_1",
        email: "client@example.com",
        deidentifiedAt: null,
      }),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
}));

import { POST } from "@/app/api/client/trainers/[username]/service-checkout/route";

describe("POST /api/client/trainers/[username]/service-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionClientIdMock.mockResolvedValue("client_1");
    prismaTrainerFindUniqueMock.mockResolvedValue({
      id: "trainer_1",
      username: "coach-pre",
      deidentifiedAt: null,
      profile: {
        dashboardActivatedAt: null,
        limitedDashboardUnlockedAt: new Date(),
        hasSignedTOS: true,
        serviceOfferingsJson: "{}",
        clientsCanPurchaseServicesFromProfile: true,
      },
    });
    isTrainerVisibleInClientDiscoveryMock.mockReturnValue(true);
    isTrainerBookableForClientsMock.mockReturnValue(false);
    trainerBookableBlockedMessageMock.mockReturnValue(
      "This coach is finishing verification. You can chat now — booking unlocks when they're verified.",
    );
  });

  it("rejects checkout for pre-verified coaches", async () => {
    const res = await POST(
      new Request("https://matchfit.test/api/client/trainers/coach-pre/service-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: "svc_1" }),
      }),
      { params: Promise.resolve({ username: "coach-pre" }) },
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "TRAINER_VERIFICATION_IN_PROGRESS",
    });
  });
});
