import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: findManyMock,
    },
  },
}));

describe("listRegisteredTrainersForOutreach", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("maps registered trainers with normalized Instagram links", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "t1",
        username: "coachamy",
        preferredName: "Coach Amy",
        firstName: "Amy",
        lastName: "Reed",
        email: "amy@example.com",
        socialInstagram: "https://instagram.com/coachamy",
        socialFacebook: null,
        fitnessNiches: "Strength",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    ]);

    const { listRegisteredTrainersForOutreach } = await import("@/lib/outreach-registered-trainers");
    const rows = await listRegisteredTrainersForOutreach();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toBe("Coach Amy");
    expect(rows[0]?.instagramHandle).toBe("@coachamy");
    expect(rows[0]?.instagramUrl).toBe("https://instagram.com/coachamy");
  });
});
