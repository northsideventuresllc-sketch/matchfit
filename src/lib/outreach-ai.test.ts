import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminAiProviderStatusAsync,
  mockBuildOutreachLearningContext,
  mockTrainerFindMany,
  mockOutreachInstagramLeadFindMany,
  mockOutreachFacebookLeadFindMany,
  mockOutreachEmailLeadFindMany,
  mockOutreachOtherLeadFindMany,
  mockOutreachOtherLeadCreate,
} = vi.hoisted(() => ({
  mockGetAdminAiProviderStatusAsync: vi.fn(),
  mockBuildOutreachLearningContext: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockOutreachInstagramLeadFindMany: vi.fn(),
  mockOutreachFacebookLeadFindMany: vi.fn(),
  mockOutreachEmailLeadFindMany: vi.fn(),
  mockOutreachOtherLeadFindMany: vi.fn(),
  mockOutreachOtherLeadCreate: vi.fn(),
}));

vi.mock("@/lib/admin-analytics-ai", () => ({
  getAdminAiProviderStatusAsync: mockGetAdminAiProviderStatusAsync,
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
    outreachOtherLead: {
      findMany: mockOutreachOtherLeadFindMany,
      create: mockOutreachOtherLeadCreate,
    },
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

function mockSuccessfulOpenAiCall(text: string) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: text } }],
    }),
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
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

    mockGetAdminAiProviderStatusAsync.mockResolvedValue({
      configured: true,
      provider: "openai",
      message: "ok",
    });
    mockBuildOutreachLearningContext.mockResolvedValue("learning-summary");
    mockTrainerFindMany.mockResolvedValue([]);
    mockOutreachInstagramLeadFindMany.mockResolvedValue([]);
    mockOutreachFacebookLeadFindMany.mockResolvedValue([]);
    mockOutreachEmailLeadFindMany.mockResolvedValue([]);
    mockOutreachOtherLeadFindMany.mockResolvedValue([]);
    mockOutreachOtherLeadCreate.mockReset();
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    vi.unstubAllGlobals();
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
      atlCount: 1,
      virtualCount: 0,
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
      atlCount: 1,
      virtualCount: 0,
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
      atlCount: 1,
      virtualCount: 0,
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

  it("loads other-channel exclusions from active and archived leads and lowercases label/url", async () => {
    mockOutreachOtherLeadFindMany.mockImplementation((args: { where?: { deletedAt?: unknown } }) => {
      if (args.where?.deletedAt === null) {
        return Promise.resolve([
          { contactLabel: "Coach LinkedIn", contactUrl: "HTTPS://LinkedIn.com/in/CoachLinkedIn" },
        ]);
      }
      return Promise.resolve([]);
    });
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "other",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_4",
    });

    const activeQuery = mockOutreachOtherLeadFindMany.mock.calls[0]?.[0];
    expect(activeQuery).toEqual({
      where: { deletedAt: null },
      select: { contactLabel: true, contactUrl: true },
    });

    const prompt = extractOpenAiUserPrompt(mockFetch);
    expect(prompt).toContain("coach linkedin");
    expect(prompt).toContain("https://linkedin.com/in/coachlinkedin");
  });

  it("enforces strict raw JSON output instructions in the OpenAI system and Instagram prompts", async () => {
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "instagram",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_prompt",
    });

    const systemPrompt = extractOpenAiSystemPrompt(mockFetch);
    expect(systemPrompt).toContain("single raw JSON array starting with [ and ending with ]");
    expect(systemPrompt).toContain("If you add anything outside the JSON array the response is unusable.");

    const userPrompt = extractOpenAiUserPrompt(mockFetch);
    expect(userPrompt).toContain("Respond with ONLY the JSON array. No text before or after the array.");
  });

  it("parses object-wrapped lead arrays from AI output and persists other-channel leads", async () => {
    mockOutreachOtherLeadCreate.mockResolvedValueOnce({
      id: "other_1",
      contactLabel: "Coach LinkedIn",
      targetGroup: "ATL_LOCAL",
    });

    mockSuccessfulOpenAiCall(
      JSON.stringify({
        leads: [
          {
            contactLabel: "Coach LinkedIn",
            contactUrl: "https://linkedin.com/in/coach-linkedin",
            channelNotes: "LinkedIn outreach",
            niche: "Strength coaching",
            targetGroup: "ATL_LOCAL",
            whyMatchFit: "Active trainer with clear online coaching funnel.",
            likelihoodScore: 83,
            outreachText: "Custom message",
          },
        ],
      }),
    );

    const result = await generateOutreachLeads({
      platform: "other",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_parse_1",
    });

    expect(result.aiUsed).toBe(true);
    expect(result.leads).toEqual([
      {
        id: "other_1",
        contactLabel: "Coach LinkedIn",
        targetGroup: "ATL_LOCAL",
      },
    ]);
    expect(mockOutreachOtherLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockOutreachOtherLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactLabel: "Coach LinkedIn",
        contactUrl: "https://linkedin.com/in/coach-linkedin",
        targetGroup: "ATL_LOCAL",
        createdByAdminId: "admin_parse_1",
      }),
    });
  });

  it("parses fenced JSON arrays with preamble text and still persists leads", async () => {
    mockOutreachOtherLeadCreate.mockResolvedValueOnce({
      id: "other_2",
      contactLabel: "Coach Threads",
      targetGroup: "VIRTUAL",
    });

    mockSuccessfulOpenAiCall(`Use this list:
\`\`\`json
[
  {
    "contactLabel": "Coach Threads",
    "contactUrl": "https://threads.net/@coachthreads",
    "channelNotes": "Threads profile",
    "niche": "Online body recomposition",
    "targetGroup": "VIRTUAL",
    "whyMatchFit": "Publishes recent client check-ins and conversion posts.",
    "likelihoodScore": 76,
    "outreachText": "Another custom message"
  }
]
\`\`\``);

    const result = await generateOutreachLeads({
      platform: "other",
      atlCount: 0,
      virtualCount: 1,
      adminId: "admin_parse_2",
    });

    expect(result.aiUsed).toBe(true);
    expect(result.leads).toEqual([
      {
        id: "other_2",
        contactLabel: "Coach Threads",
        targetGroup: "VIRTUAL",
      },
    ]);
    expect(mockOutreachOtherLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockOutreachOtherLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactLabel: "Coach Threads",
        targetGroup: "VIRTUAL",
        createdByAdminId: "admin_parse_2",
      }),
    });
  });
});
