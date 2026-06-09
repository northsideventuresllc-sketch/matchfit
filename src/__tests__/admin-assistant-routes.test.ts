import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockProbeAdminAiProvider,
  mockGetAdminAiHistory,
  mockCreateAdminAiConversation,
  mockPersistAdminAiTurn,
  mockRunAdminAnalyticsAi,
  mockMaybeTitleConversationFromFirstMessage,
  mockGetAdminPortalOverview,
  mockGetAdminSiteTrafficSnapshot,
  mockAdminGoalCreate,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockProbeAdminAiProvider: vi.fn(),
  mockGetAdminAiHistory: vi.fn(),
  mockCreateAdminAiConversation: vi.fn(),
  mockPersistAdminAiTurn: vi.fn(),
  mockRunAdminAnalyticsAi: vi.fn(),
  mockMaybeTitleConversationFromFirstMessage: vi.fn(),
  mockGetAdminPortalOverview: vi.fn(),
  mockGetAdminSiteTrafficSnapshot: vi.fn(),
  mockAdminGoalCreate: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/admin-analytics-ai", () => ({
  LEGACY_CONVERSATION_ID: "legacy",
  ADMIN_ANTHROPIC_MODEL_OPTIONS: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  ],
  probeAdminAiProvider: mockProbeAdminAiProvider,
  getAdminAiHistory: mockGetAdminAiHistory,
  createAdminAiConversation: mockCreateAdminAiConversation,
  persistAdminAiTurn: mockPersistAdminAiTurn,
  runAdminAnalyticsAi: mockRunAdminAnalyticsAi,
  maybeTitleConversationFromFirstMessage: mockMaybeTitleConversationFromFirstMessage,
}));

vi.mock("@/lib/admin-portal-data", () => ({
  getAdminPortalOverview: mockGetAdminPortalOverview,
}));

vi.mock("@/lib/site-analytics", () => ({
  getAdminSiteTrafficSnapshot: mockGetAdminSiteTrafficSnapshot,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminGoal: {
      create: mockAdminGoalCreate,
    },
  },
}));

import { GET as getAssistantChat, POST as postAssistantChat } from "@/app/api/admin/assistant/chat/route";
import { GET as getAssistantStatus } from "@/app/api/admin/assistant/status/route";

function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin assistant routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockProbeAdminAiProvider.mockResolvedValue({
      provider: "anthropic",
      configured: true,
      working: true,
      model: "claude-sonnet-4-6",
      message: "ok",
    });
    mockGetAdminAiHistory.mockResolvedValue([]);
    mockCreateAdminAiConversation.mockResolvedValue({ id: "conv_new" });
    mockRunAdminAnalyticsAi.mockResolvedValue("Assistant response");
    mockGetAdminPortalOverview.mockResolvedValue({
      revenue: { activePlatformSubscribers: 12 },
    });
    mockGetAdminSiteTrafficSnapshot.mockResolvedValue({ windowDays: 7, uniqueVisitors: 44 });
    mockAdminGoalCreate.mockResolvedValue({ id: "goal_1" });
  });

  it("returns 401 for assistant status when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await getAssistantStatus();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockProbeAdminAiProvider).not.toHaveBeenCalled();
  });

  it("returns available Anthropic models in assistant status", async () => {
    const res = await getAssistantStatus();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      provider: "anthropic",
      configured: true,
      working: true,
      model: "claude-sonnet-4-6",
      message: "ok",
      availableModels: [
        { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
        { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      ],
    });
  });

  it("returns empty available models for non-Anthropic providers", async () => {
    mockProbeAdminAiProvider.mockResolvedValueOnce({
      provider: "openai",
      configured: true,
      working: true,
      model: "gpt-4o-mini",
      message: "ok",
    });

    const res = await getAssistantStatus();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      provider: "openai",
      configured: true,
      working: true,
      model: "gpt-4o-mini",
      message: "ok",
      availableModels: [],
    });
  });

  it("returns 401 for assistant chat GET when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await getAssistantChat(new Request("https://matchfit.test/api/admin/assistant/chat"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockGetAdminAiHistory).not.toHaveBeenCalled();
  });

  it("loads legacy chat history when conversationId=legacy", async () => {
    mockGetAdminAiHistory.mockResolvedValueOnce([{ id: "m1", role: "user", content: "hello" }]);

    const res = await getAssistantChat(
      new Request("https://matchfit.test/api/admin/assistant/chat?conversationId=legacy"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      messages: [{ id: "m1", role: "user", content: "hello" }],
    });
    expect(mockGetAdminAiHistory).toHaveBeenCalledWith("admin_1", { conversationId: "legacy" });
  });

  it("returns 400 for assistant chat POST when payload is invalid", async () => {
    const res = await postAssistantChat(postJson("https://matchfit.test/api/admin/assistant/chat", { action: "noop" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
    expect(mockCreateAdminAiConversation).not.toHaveBeenCalled();
  });

  it("creates a conversation and persists user/assistant turns for valid chat messages", async () => {
    mockGetAdminAiHistory.mockResolvedValueOnce([{ role: "user", content: "How are signups?" }]);

    const res = await postAssistantChat(
      postJson("https://matchfit.test/api/admin/assistant/chat", {
        action: "freeform",
        message: "How are signups?",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      reply: "Assistant response",
      conversationId: "conv_new",
    });
    expect(mockCreateAdminAiConversation).toHaveBeenCalledWith("admin_1");
    expect(mockPersistAdminAiTurn).toHaveBeenCalledTimes(2);
    expect(mockPersistAdminAiTurn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        administratorId: "admin_1",
        conversationId: "conv_new",
        role: "user",
        content: "How are signups?",
        actionType: "freeform",
      }),
    );
    expect(mockMaybeTitleConversationFromFirstMessage).toHaveBeenCalledWith(
      "conv_new",
      "How are signups?",
    );
    expect(mockRunAdminAnalyticsAi).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "freeform",
        administratorId: "admin_1",
        userMessage: "How are signups?",
        history: [],
      }),
    );
    expect(mockPersistAdminAiTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        administratorId: "admin_1",
        conversationId: "conv_new",
        role: "assistant",
        content: "Assistant response",
      }),
    );
  });

  it("stores set-goal data with trimmed fields when a goal title is supplied", async () => {
    mockGetAdminAiHistory.mockResolvedValueOnce([{ role: "user", content: "goal message" }]);

    const res = await postAssistantChat(
      postJson("https://matchfit.test/api/admin/assistant/chat", {
        action: "set_goal",
        goalTitle: "  Reach 100 subscribers  ",
        goalDescription: "  by end of month ",
        targetMetric: " active_subscribers ",
        targetValue: 100,
      }),
    );

    expect(res.status).toBe(200);
    expect(mockAdminGoalCreate).toHaveBeenCalledWith({
      data: {
        administratorId: "admin_1",
        title: "Reach 100 subscribers",
        description: "by end of month",
        targetMetric: "active_subscribers",
        targetValue: 100,
      },
    });
  });
});
