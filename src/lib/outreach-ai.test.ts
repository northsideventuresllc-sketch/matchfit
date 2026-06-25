import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCallMatchFitAi,
  mockHydratePlatformEnvFromDatabase,
  mockBuildOutreachLearningContext,
  mockTrainerFindMany,
  mockOutreachInstagramLeadFindMany,
  mockOutreachFacebookLeadFindMany,
  mockOutreachEmailLeadFindMany,
} = vi.hoisted(() => ({
  mockCallMatchFitAi: vi.fn(),
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockBuildOutreachLearningContext: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockOutreachInstagramLeadFindMany: vi.fn(),
  mockOutreachFacebookLeadFindMany: vi.fn(),
  mockOutreachEmailLeadFindMany: vi.fn(),
}));

vi.mock("@/lib/ai-vault/router", () => ({
  callMatchFitAi: mockCallMatchFitAi,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("@/lib/outreach-learning", () => ({
  buildOutreachLearningContext: mockBuildOutreachLearningContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findMany: mockTrainerFindMany },
    outreachInstagramLead: { findMany: mockOutreachInstagramLeadFindMany },
    outreachFacebookLead: { findMany: mockOutreachFacebookLeadFindMany },
    outreachEmailLead: { findMany: mockOutreachEmailLeadFindMany },
    outreachDailyTemplate: { createMany: vi.fn() },
  },
}));

import { generateOutreachLeads } from "@/lib/outreach-ai";

function mockFailingAiVaultCall() {
  mockCallMatchFitAi.mockResolvedValue({
    text: null,
    provider: null,
    model: null,
    complexity: "complex",
    usedFallback: false,
    error: "All AI providers failed.",
    attempts: [{ provider: "anthropic", model: "claude-sonnet-4-6", error: "server_error" }],
  });
}

describe("outreach-ai generation prompts and parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockFailingAiVaultCall();
    mockBuildOutreachLearningContext.mockResolvedValue("learning-summary");
    mockTrainerFindMany.mockResolvedValue([]);
    mockOutreachInstagramLeadFindMany.mockResolvedValue([]);
    mockOutreachFacebookLeadFindMany.mockResolvedValue([]);
    mockOutreachEmailLeadFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it("uses Anthropic web search for Instagram generation when configured", async () => {
    await generateOutreachLeads({
      platform: "instagram",
      leadCount: 1,
      adminId: "admin_anthropic",
    });

    expect(mockCallMatchFitAi).toHaveBeenCalledTimes(1);
    const callArgs = mockCallMatchFitAi.mock.calls[0]?.[0];
    expect(callArgs?.anthropicTools?.[0]).toMatchObject({
      type: "web_search_20250305",
      name: "web_search",
    });
    expect(callArgs?.system).toContain("Use web search before answering");
    expect(callArgs?.user).toContain("Respond with ONLY the JSON array");
  });

  it("loads Instagram exclusions from active and archived leads and lowercases entries", async () => {
    mockOutreachInstagramLeadFindMany.mockImplementation((args: { where?: { deletedAt?: unknown } }) => {
      if (args.where?.deletedAt === null) {
        return Promise.resolve([
          { handle: "@CoachATL", profileUrl: "HTTPS://Instagram.com/CoachATL" },
        ]);
      }
      return Promise.resolve([]);
    });

    await generateOutreachLeads({
      platform: "instagram",
      leadCount: 1,
      adminId: "admin_1",
    });

    const activeQuery = mockOutreachInstagramLeadFindMany.mock.calls[0]?.[0];
    expect(activeQuery).toEqual({
      where: { deletedAt: null },
      select: { handle: true, profileUrl: true },
    });

    const prompt = mockCallMatchFitAi.mock.calls[0]?.[0]?.user ?? "";
    expect(prompt).toContain("@coachatl");
    expect(prompt).toContain("https://instagram.com/coachatl");
  });

  it("loads Facebook exclusions from active and archived leads and lowercases entries", async () => {
    mockOutreachFacebookLeadFindMany.mockImplementation((args: { where?: { deletedAt?: unknown } }) => {
      if (args.where?.deletedAt === null) {
        return Promise.resolve([
          { pageUrl: "HTTPS://Facebook.com/StrongFit", pageName: "Strong Fit ATL" },
        ]);
      }
      return Promise.resolve([]);
    });

    await generateOutreachLeads({
      platform: "facebook",
      leadCount: 1,
      adminId: "admin_2",
    });

    const activeQuery = mockOutreachFacebookLeadFindMany.mock.calls[0]?.[0];
    expect(activeQuery).toEqual({
      where: { deletedAt: null },
      select: { pageUrl: true, pageName: true },
    });

    const prompt = mockCallMatchFitAi.mock.calls[0]?.[0]?.user ?? "";
    expect(prompt).toContain("https://facebook.com/strongfit");
    expect(prompt).toContain("strong fit atl");
  });

  it("loads email exclusions from active and archived leads and lowercases entries", async () => {
    mockOutreachEmailLeadFindMany.mockImplementation((args: { where?: { deletedAt?: unknown } }) => {
      if (args.where?.deletedAt === null) {
        return Promise.resolve([{ email: "COACH@MAIL.COM" }]);
      }
      return Promise.resolve([]);
    });

    await generateOutreachLeads({
      platform: "email",
      leadCount: 1,
      adminId: "admin_3",
    });

    const activeQuery = mockOutreachEmailLeadFindMany.mock.calls[0]?.[0];
    expect(activeQuery).toEqual({
      where: { deletedAt: null },
      select: { email: true },
    });

    const prompt = mockCallMatchFitAi.mock.calls[0]?.[0]?.user ?? "";
    expect(prompt).toContain("coach@mail.com");
  });

  it("rejects unsupported outreach platforms", async () => {
    await expect(
      generateOutreachLeads({
        platform: "other" as "instagram",
        leadCount: 1,
        adminId: "admin_4",
      }),
    ).rejects.toThrow(/Unsupported outreach platform/);
  });

  it("enforces strict raw JSON output instructions in the system and Instagram prompts", async () => {
    await generateOutreachLeads({
      platform: "instagram",
      leadCount: 1,
      adminId: "admin_prompt",
    });

    const systemPrompt = mockCallMatchFitAi.mock.calls[0]?.[0]?.system ?? "";
    expect(systemPrompt).toContain("single raw JSON array starting with [ and ending with ]");
    expect(systemPrompt).toContain("If you add anything outside the JSON array the response is unusable.");

    const userPrompt = mockCallMatchFitAi.mock.calls[0]?.[0]?.user ?? "";
    expect(userPrompt).toContain("Respond with ONLY the JSON array.");
  });
});
