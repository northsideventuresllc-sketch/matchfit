import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockHydratePlatformEnvFromDatabase } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockHydratePlatformEnvFromDatabase: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

import {
  createNiBrainClient,
  ensureNiBrainEnvHydrated,
  fetchNiBrainMatchFitContext,
  fetchRecentContentLearnings,
  isNiBrainConfigured,
  isNiBrainConfiguredAsync,
  recordContentLearning,
} from "@/lib/ni-brain-client";

describe("ni-brain-client", () => {
  const previousUrl = process.env.NI_BRAIN_SUPABASE_URL;
  const previousServiceRoleKey = process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NI_BRAIN_SUPABASE_URL = "https://kxijunwgbrlfzvgkhklo.supabase.co";
    process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY = "service-role-key-at-least-20";
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NI_BRAIN_SUPABASE_URL;
    else process.env.NI_BRAIN_SUPABASE_URL = previousUrl;

    if (previousServiceRoleKey === undefined) delete process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  });

  it("requires both NI Brain env keys for sync configuration check", () => {
    expect(isNiBrainConfigured()).toBe(true);

    delete process.env.NI_BRAIN_SUPABASE_URL;
    expect(isNiBrainConfigured()).toBe(false);

    process.env.NI_BRAIN_SUPABASE_URL = "https://kxijunwgbrlfzvgkhklo.supabase.co";
    delete process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;
    expect(isNiBrainConfigured()).toBe(false);
  });

  it("hydrates env before async configuration checks", async () => {
    const result = await isNiBrainConfiguredAsync();

    expect(result).toBe(true);
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
  });

  it("delegates explicit hydration helper to hydrate-platform-env", async () => {
    await ensureNiBrainEnvHydrated();
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
  });

  it("throws when creating a client without required env keys", () => {
    delete process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createNiBrainClient()).toThrow(
      "NI Brain is not configured. Set NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY.",
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("creates a server-safe Supabase client with trimmed env values", () => {
    process.env.NI_BRAIN_SUPABASE_URL = "  https://kxijunwgbrlfzvgkhklo.supabase.co  ";
    process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY = "  service-role-key-at-least-20  ";
    const clientRef = { from: vi.fn() };
    mockCreateClient.mockReturnValueOnce(clientRef);

    const client = createNiBrainClient();

    expect(client).toBe(clientRef);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://kxijunwgbrlfzvgkhklo.supabase.co",
      "service-role-key-at-least-20",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  });

  it("loads and trims Match Fit context from the NI Brain project", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { content: "  MATCH FIT positioning notes  " },
    });
    const fromMock = vi.fn((table: string) => {
      if (table !== "Context") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          ilike: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        }),
      };
    });
    mockCreateClient.mockReturnValueOnce({ from: fromMock });

    const result = await fetchNiBrainMatchFitContext();

    expect(result).toBe("MATCH FIT positioning notes");
    expect(fromMock).toHaveBeenCalledWith("Context");
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("returns an empty context when NI Brain is not configured", async () => {
    delete process.env.NI_BRAIN_SUPABASE_URL;

    const result = await fetchNiBrainMatchFitContext();

    expect(result).toBe("");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("combines recent social signals and learnings into prompt-ready lines", async () => {
    const signalsLimit = vi.fn().mockResolvedValue({
      data: [
        {
          signal_type: "EDIT_DIFF",
          edited_text: "Use direct CTA language with clear outcomes.",
          meta_json: { field: "caption" },
        },
        {
          signal_type: "SOCIAL_SCAN",
          edited_text: "Video-first content produced the strongest trainer engagement.",
          meta_json: null,
        },
      ],
    });
    const learningsLimit = vi.fn().mockResolvedValue({
      data: [
        {
          learning: "Posting 4 PM ET performs better than morning for reels.",
          source: "match fit content learnings",
        },
      ],
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "match_fit_content_learning_signals") {
        return {
          select: () => ({
            order: () => ({
              limit: signalsLimit,
            }),
          }),
        };
      }

      if (table === "Learnings") {
        return {
          select: () => ({
            ilike: () => ({
              order: () => ({
                limit: learningsLimit,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValueOnce({ from: fromMock });

    const lines = await fetchRecentContentLearnings(3);

    expect(lines).toEqual([
      'Operator prefers caption tone like: "Use direct CTA language with clear outcomes."',
      "Social insight: Video-first content produced the strongest trainer engagement.",
      "[match fit content learnings] Posting 4 PM ET performs better than morning for reels.",
    ]);
    expect(signalsLimit).toHaveBeenCalledWith(3);
    expect(learningsLimit).toHaveBeenCalledWith(5);
  });

  it("records signal rows and promotes meaningful edit diffs into Learnings", async () => {
    const signalsInsert = vi.fn().mockResolvedValue({});
    const learningsInsert = vi.fn().mockResolvedValue({});
    const fromMock = vi.fn((table: string) => {
      if (table === "match_fit_content_learning_signals") {
        return { insert: signalsInsert };
      }

      if (table === "Learnings") {
        return { insert: learningsInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValueOnce({ from: fromMock });

    await recordContentLearning({
      signalType: "EDIT_DIFF",
      postId: "post_123",
      originalText: "Original draft copy.",
      editedText: "Edited copy with stronger CTA.",
      meta: { field: "caption" },
    });

    expect(signalsInsert).toHaveBeenCalledWith({
      signal_type: "EDIT_DIFF",
      post_id: "post_123",
      original_text: "Original draft copy.",
      edited_text: "Edited copy with stronger CTA.",
      meta_json: { field: "caption" },
    });
    expect(learningsInsert).toHaveBeenCalledTimes(1);
    expect(learningsInsert.mock.calls[0]?.[0]).toMatchObject({
      source: "match fit content calendar",
    });
  });

  it("does not create Learnings rows when the edit text is effectively unchanged", async () => {
    const signalsInsert = vi.fn().mockResolvedValue({});
    const learningsInsert = vi.fn().mockResolvedValue({});
    const fromMock = vi.fn((table: string) => {
      if (table === "match_fit_content_learning_signals") {
        return { insert: signalsInsert };
      }

      if (table === "Learnings") {
        return { insert: learningsInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValueOnce({ from: fromMock });

    await recordContentLearning({
      signalType: "EDIT_DIFF",
      originalText: "No change",
      editedText: "  No change  ",
      meta: { field: "caption" },
    });

    expect(signalsInsert).toHaveBeenCalledTimes(1);
    expect(learningsInsert).not.toHaveBeenCalled();
  });

  it("no-ops signal recording when NI Brain env is not configured", async () => {
    delete process.env.NI_BRAIN_SUPABASE_URL;

    await recordContentLearning({
      signalType: "SOCIAL_SCAN",
      editedText: "New social scan insight",
    });

    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
