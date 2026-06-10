import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockListOutreachHubLeads,
  mockBuildOutreachHubCsv,
  mockMassSaveOutreachLeadsToHub,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockListOutreachHubLeads: vi.fn(),
  mockBuildOutreachHubCsv: vi.fn(),
  mockMassSaveOutreachLeadsToHub: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/outreach-data", () => ({
  listOutreachHubLeads: mockListOutreachHubLeads,
  buildOutreachHubCsv: mockBuildOutreachHubCsv,
  massSaveOutreachLeadsToHub: mockMassSaveOutreachLeadsToHub,
}));

import { GET as getOutreachHub } from "@/app/api/admin/outreach/hub/route";
import { GET as exportOutreachHub } from "@/app/api/admin/outreach/hub/export/route";
import { POST as bulkSaveOutreachLeads } from "@/app/api/admin/outreach/leads/bulk-save/route";

function postBulkSaveJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/outreach/leads/bulk-save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin outreach hub routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: false,
    });
    mockListOutreachHubLeads.mockResolvedValue([]);
    mockBuildOutreachHubCsv.mockReturnValue("Platform,Name\ninstagram,coach");
    mockMassSaveOutreachLeadsToHub.mockResolvedValue({ savedCount: 2 });
  });

  describe("GET /api/admin/outreach/hub", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockRequireAdminSession.mockResolvedValueOnce(null);
      const response = await getOutreachHub();
      expect(response.status).toBe(401);
    });

    it("returns saved hub leads for authorized admins", async () => {
      mockListOutreachHubLeads.mockResolvedValueOnce([
        {
          platform: "instagram",
          savedToHubAt: "2026-06-09T12:00:00.000Z",
          lead: { id: "ig_1", handle: "coach_j" },
        },
      ]);

      const response = await getOutreachHub();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        leads: [
          {
            platform: "instagram",
            savedToHubAt: "2026-06-09T12:00:00.000Z",
            lead: { id: "ig_1", handle: "coach_j" },
          },
        ],
        total: 1,
      });
    });
  });

  describe("GET /api/admin/outreach/hub/export", () => {
    it("returns a CSV attachment for authorized admins", async () => {
      const response = await exportOutreachHub();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain("attachment");
      await expect(response.text()).resolves.toBe("Platform,Name\ninstagram,coach");
    });
  });

  describe("POST /api/admin/outreach/leads/bulk-save", () => {
    it("returns savedCount for valid bulk save requests", async () => {
      const response = await bulkSaveOutreachLeads(
        postBulkSaveJson({ platform: "instagram", mode: "all" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true, savedCount: 2 });
      expect(mockMassSaveOutreachLeadsToHub).toHaveBeenCalledWith("instagram", { mode: "all" });
    });

    it("returns 400 for invalid payloads", async () => {
      const response = await bulkSaveOutreachLeads(postBulkSaveJson({ platform: "instagram" }));
      expect(response.status).toBe(400);
    });
  });
});
