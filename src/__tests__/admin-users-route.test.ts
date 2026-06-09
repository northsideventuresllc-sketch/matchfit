import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const clientMainWhere = { __tag: "client-main" };
const clientLegacyWhere = { __tag: "client-legacy" };
const trainerDirectoryWhere = { __tag: "trainer-directory" };
const trainerDirectoryLegacyWhere = { __tag: "trainer-directory-legacy" };

const {
  mockVerifyAdminSessionToken,
  mockAdministratorFindUnique,
  mockClientFindMany,
  mockTrainerFindMany,
  mockAdminPortalClientListWhere,
  mockAdminPortalClientListWhereLegacy,
  mockAdminPortalTrainerDirectoryWhere,
  mockAdminPortalTrainerDirectoryWhereLegacy,
  mockRedactEmailForAdminPortal,
} = vi.hoisted(() => ({
  mockVerifyAdminSessionToken: vi.fn(),
  mockAdministratorFindUnique: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockAdminPortalClientListWhere: vi.fn(),
  mockAdminPortalClientListWhereLegacy: vi.fn(),
  mockAdminPortalTrainerDirectoryWhere: vi.fn(),
  mockAdminPortalTrainerDirectoryWhereLegacy: vi.fn(),
  mockRedactEmailForAdminPortal: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  ADMIN_SESSION_COOKIE: "mf_admin_session",
  verifyAdminSessionToken: mockVerifyAdminSessionToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    administrator: {
      findUnique: mockAdministratorFindUnique,
    },
    client: {
      findMany: mockClientFindMany,
    },
    trainer: {
      findMany: mockTrainerFindMany,
    },
  },
}));

vi.mock("@/lib/admin-portal-list-filters", () => ({
  adminPortalClientListWhere: mockAdminPortalClientListWhere,
  adminPortalClientListWhereLegacy: mockAdminPortalClientListWhereLegacy,
  adminPortalTrainerDirectoryWhere: mockAdminPortalTrainerDirectoryWhere,
  adminPortalTrainerDirectoryWhereLegacy: mockAdminPortalTrainerDirectoryWhereLegacy,
  redactEmailForAdminPortal: mockRedactEmailForAdminPortal,
}));

import { GET } from "@/app/api/admin/users/route";

function missingSyntheticPersonaError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `column "internalQaSyntheticPersona" does not exist (SQLSTATE 42703)`,
    {
      code: "P2010",
      clientVersion: "unit-test",
    },
  );
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();

    mockVerifyAdminSessionToken.mockResolvedValue({ adminId: "admin_1" });
    mockAdministratorFindUnique.mockResolvedValue({ id: "admin_1" });

    mockAdminPortalClientListWhere.mockReturnValue(clientMainWhere);
    mockAdminPortalClientListWhereLegacy.mockReturnValue(clientLegacyWhere);
    mockAdminPortalTrainerDirectoryWhere.mockReturnValue(trainerDirectoryWhere);
    mockAdminPortalTrainerDirectoryWhereLegacy.mockReturnValue(trainerDirectoryLegacyWhere);
    mockRedactEmailForAdminPortal.mockImplementation((email: string) => `redacted:${email}`);

    mockClientFindMany.mockResolvedValue([
      {
        id: "client_1",
        username: "client-user",
        email: "client@example.com",
        preferredName: "  Client Preferred  ",
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ]);
    mockTrainerFindMany.mockResolvedValue([
      {
        id: "trainer_1",
        username: "trainer-user",
        email: "trainer@example.com",
        preferredName: "",
        firstName: "Taylor",
        lastName: "Coach",
        termsAcceptedAt: new Date("2026-05-26T00:00:00.000Z"),
        createdAt: new Date("2026-05-27T00:00:00.000Z"),
        profile: {
          hasSignedTOS: true,
          dashboardActivatedAt: null,
          complianceWindowStartedAt: new Date("2026-05-26T00:00:00.000Z"),
          limitedDashboardUnlockedAt: new Date("2026-05-26T00:00:00.000Z"),
          registrationFeeHoldStatus: "HELD",
          hasPaidRegistrationFee: false,
        },
      },
    ]);
  });

  it("returns 401 when the admin session cookie is missing", async () => {
    const res = await GET(new Request("https://example.test/api/admin/users"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockVerifyAdminSessionToken).not.toHaveBeenCalled();
    expect(mockAdministratorFindUnique).not.toHaveBeenCalled();
  });

  it("returns directory rows with search filters and mapped response fields", async () => {
    testCookieJar.set("mf_admin_session", "token");
    const req = new Request("https://example.test/api/admin/users?q=%20SearchTerm%20");

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockClientFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          clientMainWhere,
          {
            OR: [
              { username: { contains: "SearchTerm", mode: "insensitive" } },
              { email: { contains: "SearchTerm", mode: "insensitive" } },
              { phone: { contains: "SearchTerm" } },
              { firstName: { contains: "SearchTerm", mode: "insensitive" } },
              { lastName: { contains: "SearchTerm", mode: "insensitive" } },
              { preferredName: { contains: "SearchTerm", mode: "insensitive" } },
            ],
          },
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        preferredName: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
    expect(mockTrainerFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          trainerDirectoryWhere,
          {
            OR: [
              { username: { contains: "SearchTerm", mode: "insensitive" } },
              { email: { contains: "SearchTerm", mode: "insensitive" } },
              { phone: { contains: "SearchTerm" } },
              { firstName: { contains: "SearchTerm", mode: "insensitive" } },
              { lastName: { contains: "SearchTerm", mode: "insensitive" } },
              { preferredName: { contains: "SearchTerm", mode: "insensitive" } },
            ],
          },
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        preferredName: true,
        firstName: true,
        lastName: true,
        termsAcceptedAt: true,
        deidentifiedAt: true,
        createdAt: true,
        profile: {
          select: {
            hasSignedTOS: true,
            dashboardActivatedAt: true,
            complianceWindowStartedAt: true,
            limitedDashboardUnlockedAt: true,
            registrationFeeHoldStatus: true,
            hasPaidRegistrationFee: true,
          },
        },
      },
    });
    expect(mockRedactEmailForAdminPortal).toHaveBeenNthCalledWith(
      1,
      "client@example.com",
      "client-user",
      "client",
    );
    expect(mockRedactEmailForAdminPortal).toHaveBeenNthCalledWith(
      2,
      "trainer@example.com",
      "trainer-user",
      "trainer",
    );
    expect(body).toEqual({
      clients: [
        {
          kind: "client",
          id: "client_1",
          username: "client-user",
          email: "redacted:client@example.com",
          displayName: "Client Preferred",
          createdAt: "2026-05-28T00:00:00.000Z",
        },
      ],
      trainers: [
        {
          kind: "trainer",
          id: "trainer_1",
          username: "trainer-user",
          email: "redacted:trainer@example.com",
          displayName: "Taylor Coach",
          createdAt: "2026-05-27T00:00:00.000Z",
          membershipStatus: "pending",
          membershipStatusLabel: "Pending onboarding",
        },
      ],
    });
  });

  it("skips client queries when role=trainer", async () => {
    testCookieJar.set("mf_admin_session", "token");

    const res = await GET(new Request("https://example.test/api/admin/users?role=trainer"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockClientFindMany).not.toHaveBeenCalled();
    expect(mockTrainerFindMany).toHaveBeenCalledTimes(1);
    expect(body.clients).toEqual([]);
    expect(body.trainers).toHaveLength(1);
  });

  it("skips trainer queries when role=client", async () => {
    testCookieJar.set("mf_admin_session", "token");

    const res = await GET(new Request("https://example.test/api/admin/users?role=client"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockTrainerFindMany).not.toHaveBeenCalled();
    expect(mockClientFindMany).toHaveBeenCalledTimes(1);
    expect(body.trainers).toEqual([]);
    expect(body.clients).toHaveLength(1);
  });

  it("falls back to legacy filters when the synthetic persona column is missing", async () => {
    testCookieJar.set("mf_admin_session", "token");
    mockClientFindMany
      .mockRejectedValueOnce(missingSyntheticPersonaError())
      .mockResolvedValueOnce([
        {
          id: "client_legacy",
          username: "legacy-client",
          email: "legacy-client@example.com",
          preferredName: null,
          createdAt: new Date("2026-05-26T00:00:00.000Z"),
        },
      ]);
    mockTrainerFindMany
      .mockRejectedValueOnce(missingSyntheticPersonaError())
      .mockResolvedValueOnce([
        {
          id: "trainer_legacy",
          username: "legacy-trainer",
          email: "legacy-trainer@example.com",
          preferredName: null,
          firstName: "",
          lastName: "",
          termsAcceptedAt: null,
          createdAt: new Date("2026-05-25T00:00:00.000Z"),
          profile: {
            hasSignedTOS: false,
            dashboardActivatedAt: null,
            complianceWindowStartedAt: null,
            limitedDashboardUnlockedAt: null,
            registrationFeeHoldStatus: "NOT_STARTED",
            hasPaidRegistrationFee: false,
          },
        },
      ]);

    const res = await GET(new Request("https://example.test/api/admin/users"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAdminPortalClientListWhereLegacy).toHaveBeenCalledTimes(1);
    expect(mockAdminPortalTrainerDirectoryWhereLegacy).toHaveBeenCalledTimes(1);
    expect(mockClientFindMany.mock.calls[0]?.[0]).toMatchObject({ where: clientMainWhere });
    expect(mockClientFindMany.mock.calls[1]?.[0]).toMatchObject({ where: clientLegacyWhere });
    expect(mockTrainerFindMany.mock.calls[0]?.[0]).toMatchObject({ where: trainerDirectoryWhere });
    expect(mockTrainerFindMany.mock.calls[1]?.[0]).toMatchObject({ where: trainerDirectoryLegacyWhere });
    expect(body.clients[0]).toMatchObject({
      id: "client_legacy",
      displayName: "legacy-client",
    });
    expect(body.trainers[0]).toMatchObject({
      id: "trainer_legacy",
      displayName: "legacy-trainer",
    });
  });

  it("returns 500 for unexpected query errors", async () => {
    testCookieJar.set("mf_admin_session", "token");
    mockClientFindMany.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await GET(new Request("https://example.test/api/admin/users"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Could not load directory." });
    expect(mockAdminPortalClientListWhereLegacy).not.toHaveBeenCalled();
    expect(mockTrainerFindMany).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
