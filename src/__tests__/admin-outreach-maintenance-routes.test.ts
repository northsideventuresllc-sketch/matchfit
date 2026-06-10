import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockPurgeArchivedOutreachLeads,
  mockPurgeActiveOutreachLeads,
  mockListRegisteredTrainersForOutreach,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockPurgeArchivedOutreachLeads: vi.fn(),
  mockPurgeActiveOutreachLeads: vi.fn(),
  mockListRegisteredTrainersForOutreach: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/outreach-data", () => ({
  purgeArchivedOutreachLeads: mockPurgeArchivedOutreachLeads,
  purgeActiveOutreachLeads: mockPurgeActiveOutreachLeads,
}));

vi.mock("@/lib/outreach-registered-trainers", () => ({
  listRegisteredTrainersForOutreach: mockListRegisteredTrainersForOutreach,
}));

import { POST as purgeOutreach } from "@/app/api/admin/outreach/purge/route";
import { GET as listRegisteredOutreachTrainers } from "@/app/api/admin/outreach/registered-trainers/route";

function postPurgeJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/outreach/purge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin outreach maintenance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: false,
    });
    mockPurgeArchivedOutreachLeads.mockResolvedValue({
      instagram: 1,
      facebook: 2,
      email: 0,
      other: 0,
    });
    mockPurgeActiveOutreachLeads.mockResolvedValue({
      instagram: 0,
      facebook: 0,
      email: 0,
      other: 0,
    });
    mockListRegisteredTrainersForOutreach.mockResolvedValue([]);
  });

  describe("POST /api/admin/outreach/purge", () => {
    it("returns 401 when the requester is not an authenticated admin", async () => {
      mockRequireAdminSession.mockResolvedValueOnce(null);

      const response = await purgeOutreach(postPurgeJson({ scope: "all" }));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockPurgeArchivedOutreachLeads).not.toHaveBeenCalled();
      expect(mockPurgeActiveOutreachLeads).not.toHaveBeenCalled();
    });

    it("returns 400 when payload validation fails", async () => {
      const response = await purgeOutreach(postPurgeJson({ scope: "invalid" }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Invalid request." });
      expect(mockPurgeArchivedOutreachLeads).not.toHaveBeenCalled();
      expect(mockPurgeActiveOutreachLeads).not.toHaveBeenCalled();
    });

    it("defaults to archived scope and returns a success summary", async () => {
      const response = await purgeOutreach(postPurgeJson({}));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        scope: "archived",
        removed: { instagram: 1, facebook: 2, email: 0, other: 0 },
        total: 3,
        message: "Removed 3 outreach row(s). Generate with AI to refill with verified leads.",
      });
      expect(mockPurgeArchivedOutreachLeads).toHaveBeenCalledTimes(1);
      expect(mockPurgeActiveOutreachLeads).not.toHaveBeenCalled();
    });

    it("purges archived and active rows when scope is all", async () => {
      mockPurgeArchivedOutreachLeads.mockResolvedValueOnce({
        instagram: 2,
        facebook: 0,
        email: 1,
        other: 1,
      });
      mockPurgeActiveOutreachLeads.mockResolvedValueOnce({
        instagram: 1,
        facebook: 3,
        email: 0,
        other: 2,
      });

      const response = await purgeOutreach(postPurgeJson({ scope: "all" }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        scope: "all",
        removed: { instagram: 3, facebook: 3, email: 1, other: 3 },
        total: 10,
        message: "Removed 10 outreach row(s). Generate with AI to refill with verified leads.",
      });
      expect(mockPurgeArchivedOutreachLeads).toHaveBeenCalledTimes(1);
      expect(mockPurgeActiveOutreachLeads).toHaveBeenCalledTimes(1);
    });

    it("returns no-match message when purge scope removes zero rows", async () => {
      const response = await purgeOutreach(postPurgeJson({ scope: "active" }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        scope: "active",
        removed: { instagram: 0, facebook: 0, email: 0, other: 0 },
        total: 0,
        message: "No outreach rows matched that purge scope.",
      });
      expect(mockPurgeArchivedOutreachLeads).not.toHaveBeenCalled();
      expect(mockPurgeActiveOutreachLeads).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when purge throws unexpectedly", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockPurgeArchivedOutreachLeads.mockRejectedValueOnce(new Error("db unavailable"));

      const response = await purgeOutreach(postPurgeJson({ scope: "archived" }));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Could not purge outreach leads." });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("GET /api/admin/outreach/registered-trainers", () => {
    it("returns 401 when the requester is not an authenticated admin", async () => {
      mockRequireAdminSession.mockResolvedValueOnce(null);

      const response = await listRegisteredOutreachTrainers();

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockListRegisteredTrainersForOutreach).not.toHaveBeenCalled();
    });

    it("returns trainers and total for authorized admins", async () => {
      mockListRegisteredTrainersForOutreach.mockResolvedValueOnce([
        {
          id: "trainer_1",
          username: "coachjordan",
          displayName: "Coach Jordan",
          email: "r***@example.com",
          instagramHandle: "@coachjordan",
          instagramUrl: "https://instagram.com/coachjordan",
          facebookUrl: null,
          fitnessNiches: "Strength",
          createdAt: "2026-06-10T00:00:00.000Z",
        },
      ]);

      const response = await listRegisteredOutreachTrainers();

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        trainers: [
          {
            id: "trainer_1",
            username: "coachjordan",
            displayName: "Coach Jordan",
            email: "r***@example.com",
            instagramHandle: "@coachjordan",
            instagramUrl: "https://instagram.com/coachjordan",
            facebookUrl: null,
            fitnessNiches: "Strength",
            createdAt: "2026-06-10T00:00:00.000Z",
          },
        ],
        total: 1,
      });
      expect(mockListRegisteredTrainersForOutreach).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when trainer listing throws unexpectedly", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockListRegisteredTrainersForOutreach.mockRejectedValueOnce(new Error("query failed"));

      const response = await listRegisteredOutreachTrainers();

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Could not load registered trainers." });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
