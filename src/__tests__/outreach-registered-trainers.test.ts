import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const trainerWhere = { __tag: "trainer-main-where" };
const trainerLegacyWhere = { __tag: "trainer-legacy-where" };

const {
  findManyMock,
  mockAdminPortalTrainerListWhere,
  mockAdminPortalTrainerListWhereLegacy,
  mockRedactEmailForAdminPortal,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  mockAdminPortalTrainerListWhere: vi.fn(),
  mockAdminPortalTrainerListWhereLegacy: vi.fn(),
  mockRedactEmailForAdminPortal: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/lib/admin-portal-list-filters", () => ({
  adminPortalTrainerListWhere: mockAdminPortalTrainerListWhere,
  adminPortalTrainerListWhereLegacy: mockAdminPortalTrainerListWhereLegacy,
  redactEmailForAdminPortal: mockRedactEmailForAdminPortal,
}));

function missingSyntheticPersonaError(code: "P2021" | "P2022"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`missing synthetic persona column (${code})`, {
    code,
    clientVersion: "unit-test",
  });
}

describe("listRegisteredTrainersForOutreach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminPortalTrainerListWhere.mockReturnValue(trainerWhere);
    mockAdminPortalTrainerListWhereLegacy.mockReturnValue(trainerLegacyWhere);
    mockRedactEmailForAdminPortal.mockImplementation((email: string) => `redacted:${email}`);
  });

  it("maps registered trainers with normalized social links and redacted emails", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "trainer_1",
        username: "coachamy",
        preferredName: "  Coach Amy  ",
        firstName: "Amy",
        lastName: "Reed",
        email: "amy@example.com",
        socialInstagram: "https://instagram.com/CoachAmy/",
        socialFacebook: " https://facebook.com/coachamy ",
        fitnessNiches: " Strength ",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    ]);

    const { listRegisteredTrainersForOutreach } = await import("@/lib/outreach-registered-trainers");
    const rows = await listRegisteredTrainersForOutreach();

    expect(mockAdminPortalTrainerListWhere).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: trainerWhere,
      }),
    );
    expect(mockRedactEmailForAdminPortal).toHaveBeenCalledWith("amy@example.com", "coachamy", "trainer");
    expect(rows).toEqual([
      {
        id: "trainer_1",
        username: "coachamy",
        displayName: "Coach Amy",
        email: "redacted:amy@example.com",
        instagramHandle: "@coachamy",
        instagramUrl: "https://instagram.com/coachamy",
        facebookUrl: "https://facebook.com/coachamy",
        fitnessNiches: "Strength",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ]);
  });

  it.each(["P2021", "P2022"] as const)(
    "falls back to legacy trainer filters when Prisma throws %s",
    async (errorCode) => {
      findManyMock
        .mockRejectedValueOnce(missingSyntheticPersonaError(errorCode))
        .mockResolvedValueOnce([
          {
            id: "trainer_legacy",
            username: "legacy-user",
            preferredName: " ",
            firstName: "",
            lastName: "",
            email: "legacy@example.com",
            socialInstagram: "@legacy-user",
            socialFacebook: null,
            fitnessNiches: null,
            createdAt: new Date("2026-06-02T08:30:00.000Z"),
          },
        ]);

      const { listRegisteredTrainersForOutreach } = await import("@/lib/outreach-registered-trainers");
      const rows = await listRegisteredTrainersForOutreach();

      expect(mockAdminPortalTrainerListWhere).toHaveBeenCalledTimes(1);
      expect(mockAdminPortalTrainerListWhereLegacy).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: trainerWhere,
        }),
      );
      expect(findManyMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: trainerLegacyWhere,
        }),
      );
      expect(rows[0]).toMatchObject({
        username: "legacy-user",
        displayName: "legacy-user",
        instagramHandle: "@legacy-user",
        instagramUrl: "https://instagram.com/legacy-user",
        facebookUrl: null,
        fitnessNiches: null,
      });
    },
  );

  it("rethrows unexpected Prisma errors without legacy fallback", async () => {
    findManyMock.mockRejectedValueOnce(new Error("database unavailable"));

    const { listRegisteredTrainersForOutreach } = await import("@/lib/outreach-registered-trainers");

    await expect(listRegisteredTrainersForOutreach()).rejects.toThrow("database unavailable");
    expect(mockAdminPortalTrainerListWhereLegacy).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
