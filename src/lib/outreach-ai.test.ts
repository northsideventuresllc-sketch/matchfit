import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminAiProviderStatus,
  mockHydratePlatformEnvFromDatabase,
  mockBuildOutreachLearningContext,
  mockTrainerFindMany,
  mockOutreachInstagramLeadFindMany,
  mockOutreachFacebookLeadFindMany,
  mockOutreachEmailLeadFindMany,
} = vi.hoisted(() => ({
  mockGetAdminAiProviderStatus: vi.fn(),
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockBuildOutreachLearningContext: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockOutreachInstagramLeadFindMany: vi.fn(),
  mockOutreachFacebookLeadFindMany: vi.fn(),
  mockOutreachEmailLeadFindMany: vi.fn(),
}));

vi.mock("@/lib/admin-analytics-ai", () => ({
  getAdminAiProviderStatus: mockGetAdminAiProviderStatus,
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

function mockFailingOpenAiCall() {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => "server_error",
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

function mockFailingAnthropicCall() {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => "server_error",
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

function extractAnthropicUserPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
  const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(requestInit.body)) as {
    messages: Array<{ role: string; content: string }>;
  };
  return body.messages.find((m) => m.role === "user")?.content ?? "";
}

function extractOpenAiUserPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
  const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(requestInit.body)) as {
    messages: Array<{ role: string; content: string }>;
  };
  const userMessage = body.messages.find((m) => m.role === "user");
  return userMessage?.content ?? "";
}

function extractOpenAiSystemPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
  const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(requestInit.body)) as {
    messages: Array<{ role: string; content: string }>;
  };
  const systemMessage = body.messages.find((m) => m.role === "system");
  return systemMessage?.content ?? "";
}

describe("outreach-ai generation prompts and parsing", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";

    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockGetAdminAiProviderStatus.mockReturnValue({
      configured: true,
      provider: "openai",
      message: "ok",
    });
    mockBuildOutreachLearningContext.mockResolvedValue("learning-summary");
    mockTrainerFindMany.mockResolvedValue([]);
    mockOutreachInstagramLeadFindMany.mockResolvedValue([]);
    mockOutreachFacebookLeadFindMany.mockResolvedValue([]);
    mockOutreachEmailLeadFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    delete process.env.ANTHROPIC_API_KEY;
    vi.unstubAllGlobals();
  });

  it("uses Anthropic web search for Instagram generation when configured", async () => {
    mockGetAdminAiProviderStatus.mockReturnValue({
      configured: true,
      provider: "anthropic",
      message: "ok",
      model: "claude-sonnet-4-6",
    });
    const mockFetch = mockFailingAnthropicCall();

    await generateOutreachLeads({
      platform: "instagram",
      leadCount: 1,
      adminId: "admin_anthropic",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as {
      tools?: Array<{ type: string; name: string }>;
      system: string;
    };
    expect(body.tools?.[0]).toMatchObject({ type: "web_search_20250305", name: "web_search" });
    expect(body.system).toContain("Use web search before answering");
    expect(extractAnthropicUserPrompt(mockFetch)).toContain("Respond with ONLY the JSON array");
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
    const mockFetch = mockFailingOpenAiCall();

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

    const prompt = extractOpenAiUserPrompt(mockFetch);
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
    const mockFetch = mockFailingOpenAiCall();

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

    const prompt = extractOpenAiUserPrompt(mockFetch);
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
    const mockFetch = mockFailingOpenAiCall();

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

    const prompt = extractOpenAiUserPrompt(mockFetch);
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

  it("enforces strict raw JSON output instructions in the OpenAI system and Instagram prompts", async () => {
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "instagram",
      leadCount: 1,
      adminId: "admin_prompt",
    });

    const systemPrompt = extractOpenAiSystemPrompt(mockFetch);
    expect(systemPrompt).toContain("single raw JSON array starting with [ and ending with ]");
    expect(systemPrompt).toContain("If you add anything outside the JSON array the response is unusable.");

    const userPrompt = extractOpenAiUserPrompt(mockFetch);
    expect(userPrompt).toContain("Respond with ONLY the JSON array.");
  });
});
