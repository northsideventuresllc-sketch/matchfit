import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockHydrate, mockGetAiVaultStatus, mockCallMatchFitAi } = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockHydrate: vi.fn(),
  mockGetAiVaultStatus: vi.fn(),
  mockCallMatchFitAi: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydrate,
}));

vi.mock("@/lib/ai-vault", () => ({
  getAiVaultStatus: mockGetAiVaultStatus,
}));

vi.mock("@/lib/ai-vault/router", () => ({
  callMatchFitAi: mockCallMatchFitAi,
}));

import { POST } from "@/app/api/admin/ad-tracking/analyze/route";

const PANEL = {
  windowDays: 7,
  integrations: [],
  googleConversionLabels: { clientSignup: null, trainerSignup: null },
  platformDaily: [],
  attribution: [
    { utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "beta_launch", pageViews: 40, uniqueVisitors: 30, signupPageViews: 5 },
  ],
  totals: {
    meta: { impressions: 1000, clicks: 50, spendCents: 2500, conversions: 3 },
    google: { impressions: 200, clicks: 10, spendCents: 500, conversions: 1 },
    tiktok: { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 },
    attributedPageViews: 40,
    attributedSignupViews: 5,
  },
};

function postJson(body: unknown): Request {
  return new Request("https://example.test/api/admin/ad-tracking/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  question: "Which platform is spending the most per click?",
  windowDays: 7,
  panel: PANEL,
  campaigns: [{ campaignId: "beta_launch", platform: "meta", name: "Beta launch", budgetCents: 5000, weekOf: "2026-08-01" }],
};

describe("POST /api/admin/ad-tracking/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_123", testMode: false, rememberMe: true });
    mockHydrate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when the requester is not an authenticated admin", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(postJson(VALID_BODY));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 for an invalid payload", async () => {
    const res = await POST(postJson({ question: "" }));

    expect(res.status).toBe(400);
  });

  it("returns a rule-based fallback answer when no AI provider is configured", async () => {
    mockGetAiVaultStatus.mockReturnValue({ configured: false, anthropic: false, geminiPrimary: false, geminiBackup: false, message: "not configured" });

    const res = await POST(postJson(VALID_BODY));
    const json = (await res.json()) as { answer: string; usedFallback: boolean };

    expect(res.status).toBe(200);
    expect(json.usedFallback).toBe(true);
    expect(json.answer).toContain("beta_launch");
    expect(mockCallMatchFitAi).not.toHaveBeenCalled();
  });

  it("returns the AI answer when a provider is configured and responds", async () => {
    mockGetAiVaultStatus.mockReturnValue({ configured: true, anthropic: true, geminiPrimary: false, geminiBackup: false, message: "ok" });
    mockCallMatchFitAi.mockResolvedValue({ text: "Meta is your priciest click at $0.50 each.", provider: "anthropic" });

    const res = await POST(postJson(VALID_BODY));
    const json = (await res.json()) as { answer: string; usedFallback: boolean; provider?: string };

    expect(res.status).toBe(200);
    expect(json.usedFallback).toBe(false);
    expect(json.answer).toBe("Meta is your priciest click at $0.50 each.");
    expect(mockCallMatchFitAi).toHaveBeenCalledTimes(1);
  });

  it("falls back when the AI provider returns no text", async () => {
    mockGetAiVaultStatus.mockReturnValue({ configured: true, anthropic: true, geminiPrimary: false, geminiBackup: false, message: "ok" });
    mockCallMatchFitAi.mockResolvedValue({ text: null, provider: null });

    const res = await POST(postJson(VALID_BODY));
    const json = (await res.json()) as { answer: string; usedFallback: boolean };

    expect(res.status).toBe(200);
    expect(json.usedFallback).toBe(true);
  });
});
