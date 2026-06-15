import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockListOutreachHubLeads,
  mockGetOutreachPipelineStats,
  mockBuildOutreachHubCsv,
  mockMassSaveOutreachLeadsToHub,
  mockBuildMassSaveOutreachWhere,
  mockOutreachInstagramFindMany,
  mockRecordOutreachSavedToHubSignal,
  mockEnsureOutreachHubSchema,
  mockIsMissingOutreachHubSchemaError,
  mockBackfillOutreachHubLeads,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockListOutreachHubLeads: vi.fn(),
  mockGetOutreachPipelineStats: vi.fn(),
  mockBuildOutreachHubCsv: vi.fn(),
  mockMassSaveOutreachLeadsToHub: vi.fn(),
  mockBuildMassSaveOutreachWhere: vi.fn(),
  mockOutreachInstagramFindMany: vi.fn(),
  mockRecordOutreachSavedToHubSignal: vi.fn(),
  mockEnsureOutreachHubSchema: vi.fn(),
  mockIsMissingOutreachHubSchemaError: vi.fn(),
  mockBackfillOutreachHubLeads: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/outreach-data", () => ({
  listOutreachHubLeads: mockListOutreachHubLeads,
  getOutreachPipelineStats: mockGetOutreachPipelineStats,
  buildOutreachHubCsv: mockBuildOutreachHubCsv,
  massSaveOutreachLeadsToHub: mockMassSaveOutreachLeadsToHub,
  buildMassSaveOutreachWhere: mockBuildMassSaveOutreachWhere,
}));

vi.mock("@/lib/outreach-learning", () => ({
  recordOutreachSavedToHubSignal: mockRecordOutreachSavedToHubSignal,
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: mockEnsureOutreachHubSchema,
  isMissingOutreachHubSchemaError: mockIsMissingOutreachHubSchemaError,
}));

vi.mock("@/lib/outreach-hub-backfill", () => ({
  backfillOutreachHubLeads: mockBackfillOutreachHubLeads,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { findMany: mockOutreachInstagramFindMany },
    outreachFacebookLead: { findMany: vi.fn().mockResolvedValue([]) },
    outreachEmailLead: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { GET as getOutreachHub } from "@/app/api/admin/outreach/hub/route";
import { GET as exportOutreachHub } from "@/app/api/admin/outreach/hub/export/route";
import { POST as repairOutreachHubSchema } from "@/app/api/admin/outreach/hub/schema-repair/route";
import { GET as getOutreachStats } from "@/app/api/admin/outreach/stats/route";
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
    mockEnsureOutreachHubSchema.mockResolvedValue(undefined);
    mockIsMissingOutreachHubSchemaError.mockReturnValue(false);
    mockBackfillOutreachHubLeads.mockResolvedValue({
      savedToHubAtFromSignals: 0,
      legacyOtherLeadsTagged: 1,
    });
    mockListOutreachHubLeads.mockResolvedValue([]);
    mockGetOutreachPipelineStats.mockResolvedValue({
      total: 12,
      followUp: 3,
      responses: 1,
      hubSaved: 4,
      archived: 2,
    });
    mockBuildOutreachHubCsv.mockReturnValue("Platform,Name\ninstagram,coach");
    mockMassSaveOutreachLeadsToHub.mockResolvedValue({ savedCount: 2 });
    mockBuildMassSaveOutreachWhere.mockReturnValue({ deletedAt: null });
    mockOutreachInstagramFindMany.mockResolvedValue([
      {
        id: "ig_1",
        handle: "coach_j",
        niche: "Strength",
        targetGroup: "ATL_LOCAL",
        whyMatchFit: "Active",
        likelihoodScore: 80,
        status: "LEAD",
      },
    ]);
    mockRecordOutreachSavedToHubSignal.mockResolvedValue(undefined);
  });

  describe("GET /api/admin/outreach/hub", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockRequireAdminSession.mockResolvedValueOnce(null);
      const response = await getOutreachHub();
      expect(response.status).toBe(401);
    });

    it("ensures schema before listing hub leads", async () => {
      await getOutreachHub();
      expect(mockEnsureOutreachHubSchema).toHaveBeenCalled();
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
        entries: [
          {
            platform: "instagram",
            savedToHubAt: "2026-06-09T12:00:00.000Z",
            lead: { id: "ig_1", handle: "coach_j" },
          },
        ],
        total: 1,
      });
    });

    it("returns 503 when outreach hub schema is still updating", async () => {
      const schemaError = new Error("savedToHubAt does not exist");
      mockEnsureOutreachHubSchema.mockRejectedValueOnce(schemaError);
      mockIsMissingOutreachHubSchemaError.mockReturnValueOnce(true);

      const response = await getOutreachHub();
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining("Outreach Hub database schema"),
      });
    });
  });

  describe("GET /api/admin/outreach/hub/export", () => {
    it("returns a CSV attachment for authorized admins", async () => {
      const response = await exportOutreachHub();
      expect(response.status).toBe(200);
      expect(mockEnsureOutreachHubSchema).toHaveBeenCalled();
      expect(response.headers.get("Content-Type")).toContain("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain("attachment");
      await expect(response.text()).resolves.toBe("Platform,Name\ninstagram,coach");
    });
  });

  describe("POST /api/admin/outreach/hub/schema-repair", () => {
    it("returns ok when schema repair succeeds", async () => {
      const response = await repairOutreachHubSchema();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true });
      expect(mockEnsureOutreachHubSchema).toHaveBeenCalled();
    });

    it("returns 503 when schema repair cannot complete", async () => {
      const schemaError = new Error("deadLeadAt columns still missing");
      mockEnsureOutreachHubSchema.mockRejectedValueOnce(schemaError);
      mockIsMissingOutreachHubSchemaError.mockReturnValueOnce(true);

      const response = await repairOutreachHubSchema();
      expect(response.status).toBe(503);
    });
  });

  describe("GET /api/admin/outreach/stats", () => {
    it("returns pipeline stats for authorized admins", async () => {
      const response = await getOutreachStats();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        stats: {
          total: 12,
          followUp: 3,
          responses: 1,
          hubSaved: 4,
          archived: 2,
        },
      });
      expect(mockEnsureOutreachHubSchema).toHaveBeenCalled();
      expect(mockGetOutreachPipelineStats).toHaveBeenCalled();
    });

    it("returns 503 when stats cannot load due to schema drift", async () => {
      const schemaError = new Error("archivedAt does not exist");
      mockEnsureOutreachHubSchema.mockRejectedValueOnce(schemaError);
      mockIsMissingOutreachHubSchemaError.mockReturnValueOnce(true);

      const response = await getOutreachStats();
      expect(response.status).toBe(503);
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
