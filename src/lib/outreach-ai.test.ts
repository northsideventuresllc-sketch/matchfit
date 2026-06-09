import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminAiProviderStatusAsync,
  mockBuildOutreachLearningContext,
  mockOutreachInstagramLeadFindMany,
  mockOutreachFacebookLeadFindMany,
  mockOutreachEmailLeadFindMany,
  mockOutreachOtherLeadFindMany,
} = vi.hoisted(() => ({
  mockGetAdminAiProviderStatusAsync: vi.fn(),
  mockBuildOutreachLearningContext: vi.fn(),
  mockOutreachInstagramLeadFindMany: vi.fn(),
  mockOutreachFacebookLeadFindMany: vi.fn(),
  mockOutreachEmailLeadFindMany: vi.fn(),
  mockOutreachOtherLeadFindMany: vi.fn(),
}));

vi.mock("@/lib/admin-analytics-ai", () => ({
  getAdminAiProviderStatusAsync: mockGetAdminAiProviderStatusAsync,
}));

vi.mock("@/lib/outreach-learning", () => ({
  buildOutreachLearningContext: mockBuildOutreachLearningContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { findMany: mockOutreachInstagramLeadFindMany },
    outreachFacebookLead: { findMany: mockOutreachFacebookLeadFindMany },
    outreachEmailLead: { findMany: mockOutreachEmailLeadFindMany },
    outreachOtherLead: { findMany: mockOutreachOtherLeadFindMany },
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

function extractOpenAiUserPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
  const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(requestInit.body)) as {
    messages: Array<{ role: string; content: string }>;
  };
  const userMessage = body.messages.find((m) => m.role === "user");
  return userMessage?.content ?? "";
}

describe("outreach-ai exclusion queries", () => {
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
    mockOutreachInstagramLeadFindMany.mockResolvedValue([]);
    mockOutreachFacebookLeadFindMany.mockResolvedValue([]);
    mockOutreachEmailLeadFindMany.mockResolvedValue([]);
    mockOutreachOtherLeadFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    vi.unstubAllGlobals();
  });

  it("loads Instagram exclusions without deletedAt filtering and lowercases entries", async () => {
    mockOutreachInstagramLeadFindMany.mockResolvedValueOnce([
      { handle: "@CoachATL", profileUrl: "HTTPS://Instagram.com/CoachATL" },
    ]);
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "instagram",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_1",
    });

    const query = mockOutreachInstagramLeadFindMany.mock.calls[0]?.[0];
    expect(query).toEqual({
      select: { handle: true, profileUrl: true },
    });
    expect(query).not.toHaveProperty("where");

    const prompt = extractOpenAiUserPrompt(mockFetch);
    expect(prompt).toContain("@coachatl");
    expect(prompt).toContain("https://instagram.com/coachatl");
  });

  it("loads Facebook exclusions without deletedAt filtering and lowercases entries", async () => {
    mockOutreachFacebookLeadFindMany.mockResolvedValueOnce([
      { pageUrl: "HTTPS://Facebook.com/StrongFit", pageName: "Strong Fit ATL" },
    ]);
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "facebook",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_2",
    });

    const query = mockOutreachFacebookLeadFindMany.mock.calls[0]?.[0];
    expect(query).toEqual({
      select: { pageUrl: true, pageName: true },
    });
    expect(query).not.toHaveProperty("where");

    const prompt = extractOpenAiUserPrompt(mockFetch);
    expect(prompt).toContain("https://facebook.com/strongfit");
    expect(prompt).toContain("strong fit atl");
  });

  it("loads email exclusions without deletedAt filtering and lowercases entries", async () => {
    mockOutreachEmailLeadFindMany.mockResolvedValueOnce([{ email: "COACH@MAIL.COM" }]);
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "email",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_3",
    });

    const query = mockOutreachEmailLeadFindMany.mock.calls[0]?.[0];
    expect(query).toEqual({
      select: { email: true },
    });
    expect(query).not.toHaveProperty("where");

    const prompt = extractOpenAiUserPrompt(mockFetch);
    expect(prompt).toContain("coach@mail.com");
  });

  it("loads other-channel exclusions without deletedAt filtering and lowercases label/url", async () => {
    mockOutreachOtherLeadFindMany.mockResolvedValueOnce([
      { contactLabel: "Coach LinkedIn", contactUrl: "HTTPS://LinkedIn.com/in/CoachLinkedIn" },
    ]);
    const mockFetch = mockFailingOpenAiCall();

    await generateOutreachLeads({
      platform: "other",
      atlCount: 1,
      virtualCount: 0,
      adminId: "admin_4",
    });

    const query = mockOutreachOtherLeadFindMany.mock.calls[0]?.[0];
    expect(query).toEqual({
      select: { contactLabel: true, contactUrl: true },
    });
    expect(query).not.toHaveProperty("where");

    const prompt = extractOpenAiUserPrompt(mockFetch);
    expect(prompt).toContain("coach linkedin");
    expect(prompt).toContain("https://linkedin.com/in/coachlinkedin");
  });
});
