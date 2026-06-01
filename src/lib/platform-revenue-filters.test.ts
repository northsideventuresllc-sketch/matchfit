import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClientFindMany, mockTrainerFindMany, mockUpdateMany } = vi.hoisted(() => ({
  mockClientFindMany: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: mockClientFindMany },
    trainer: { findMany: mockTrainerFindMany },
    platformRevenueEvent: { updateMany: mockUpdateMany },
  },
}));

import { scrubNonLivePlatformRevenueEvents } from "./platform-revenue-filters";

describe("platform-revenue-filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientFindMany.mockResolvedValue([]);
    mockTrainerFindMany.mockResolvedValue([]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("scrubs revenue tied to excluded client and trainer ids", async () => {
    mockClientFindMany
      .mockResolvedValueOnce([{ id: "test_client" }])
      .mockResolvedValueOnce([{ id: "sandbox_client" }]);
    mockTrainerFindMany.mockResolvedValueOnce([{ id: "test_trainer" }]);
    mockUpdateMany.mockResolvedValueOnce({ count: 2 });

    await expect(scrubNonLivePlatformRevenueEvents()).resolves.toBe(2);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        billingLiveMode: true,
        OR: [{ clientId: { in: ["test_client", "sandbox_client"] } }, { trainerId: { in: ["test_trainer"] } }],
      },
      data: { billingLiveMode: false },
    });
  });

  it("returns zero when no excluded accounts exist", async () => {
    await expect(scrubNonLivePlatformRevenueEvents()).resolves.toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
