import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isTrainerVisibleInClientDiscoveryMock,
  getSessionClientIdMock,
  prismaTrainerFindUniqueMock,
} = vi.hoisted(() => ({
  isTrainerVisibleInClientDiscoveryMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  prismaTrainerFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/trainer-client-discovery", () => ({
  isTrainerVisibleInClientDiscovery: isTrainerVisibleInClientDiscoveryMock,
  trainerDiscoveryProfileSelect: {},
}));

vi.mock("@/lib/user-block-queries", () => ({
  isTrainerClientChatBlocked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/trainer-client-conversation-archive", () => ({
  purgeExpiredArchivedConversations: vi.fn(),
  conversationArchiveMetaForActor: vi.fn().mockReturnValue({ archived: false, canRevive: false }),
}));

vi.mock("@/lib/trainer-promo-tokens", () => ({
  buildClientChatTokenTipContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/marketplace-governance-overview", () => ({
  loadChatScopedClientPendingBookings: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: prismaTrainerFindUniqueMock },
    trainerClientConversation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
}));

vi.mock("@/lib/client-plan-gate", () => ({
  requireClientNotFreemiumGated: vi.fn().mockResolvedValue(null),
}));

import { GET } from "@/app/api/client/conversations/[username]/messages/route";

describe("GET /api/client/conversations/[username]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionClientIdMock.mockResolvedValue("client_1");
    prismaTrainerFindUniqueMock.mockResolvedValue({
      id: "trainer_1",
      profile: {
        dashboardActivatedAt: null,
        limitedDashboardUnlockedAt: new Date(),
        hasSignedTOS: true,
      },
    });
    isTrainerVisibleInClientDiscoveryMock.mockReturnValue(true);
  });

  it("loads chat for a pre-verified coach", async () => {
    const res = await GET(
      new Request("https://matchfit.test/api/client/conversations/coach-pre/messages"),
      { params: Promise.resolve({ username: "coach-pre" }) },
    );

    expect(res.status).toBe(200);
    expect(isTrainerVisibleInClientDiscoveryMock).toHaveBeenCalled();
  });
});
