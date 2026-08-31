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
  hasDayAllPostedEmailBeenSent,
  hasDayScheduledEmailBeenSent,
  isNiBrainConfigured,
  isNiBrainConfiguredAsync,
  recordContentLearning,
  recordDayAllPostedEmailSent,
  recordDayScheduledEmailSent,
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

  describe("day-level email idempotency signals", () => {
    function selectChain(data: unknown[] | null, error: { message: string } | null = null) {
      const eq2 = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data, error }) });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select, eq1, eq2 };
    }

    function fromReturning(expected: string, shape: Record<string, unknown>) {
      return vi.fn((table: string) => {
        if (table !== expected) throw new Error(`Unexpected table ${table}`);
        return shape;
      });
    }

    it("hasDayScheduledEmailBeenSent returns true when a matching signal row exists", async () => {
      const { select, eq1, eq2 } = selectChain([{ id: "sig_1" }]);
      const fromMock = fromReturning("match_fit_content_learning_signals", { select });
      mockCreateClient.mockReturnValueOnce({ from: fromMock });

      const result = await hasDayScheduledEmailBeenSent("2026-08-15");

      expect(result).toBe(true);
      expect(fromMock).toHaveBeenCalledWith("match_fit_content_learning_signals");
      expect(select).toHaveBeenCalledWith("id");
      expect(eq1).toHaveBeenCalledWith("signal_type", "DAY_SCHEDULED_EMAIL");
      expect(eq2).toHaveBeenCalledWith("meta_json->>postDate", "2026-08-15");
    });

    it("hasDayScheduledEmailBeenSent returns false when no signal row exists", async () => {
      const { select } = selectChain([]);
      mockCreateClient.mockReturnValueOnce({
        from: fromReturning("match_fit_content_learning_signals", { select }),
      });

      await expect(hasDayScheduledEmailBeenSent("2026-08-15")).resolves.toBe(false);
    });

    it("hasDayAllPostedEmailBeenSent filters on the DAY_ALL_POSTED_EMAIL signal type", async () => {
      const { select, eq1 } = selectChain([{ id: "sig_2" }]);
      mockCreateClient.mockReturnValueOnce({
        from: fromReturning("match_fit_content_learning_signals", { select }),
      });

      await expect(hasDayAllPostedEmailBeenSent("2026-08-16")).resolves.toBe(true);
      expect(eq1).toHaveBeenCalledWith("signal_type", "DAY_ALL_POSTED_EMAIL");
    });

    it("propagates a query error from the has* check", async () => {
      const { select } = selectChain(null, { message: "signals table unreachable" });
      mockCreateClient.mockReturnValueOnce({
        from: fromReturning("match_fit_content_learning_signals", { select }),
      });

      await expect(hasDayScheduledEmailBeenSent("2026-08-15")).rejects.toThrow("signals table unreachable");
    });

    it("has* checks short-circuit to false without a client when NI Brain is not configured", async () => {
      delete process.env.NI_BRAIN_SUPABASE_URL;

      await expect(hasDayScheduledEmailBeenSent("2026-08-15")).resolves.toBe(false);
      await expect(hasDayAllPostedEmailBeenSent("2026-08-15")).resolves.toBe(false);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("recordDayScheduledEmailSent inserts a DAY_SCHEDULED_EMAIL signal row for the date", async () => {
      const insert = vi.fn().mockResolvedValue({ error: null });
      const fromMock = fromReturning("match_fit_content_learning_signals", { insert });
      mockCreateClient.mockReturnValueOnce({ from: fromMock });

      await recordDayScheduledEmailSent("2026-08-15");

      expect(insert).toHaveBeenCalledWith({
        signal_type: "DAY_SCHEDULED_EMAIL",
        post_id: null,
        meta_json: { postDate: "2026-08-15" },
      });
    });

    it("recordDayAllPostedEmailSent inserts a DAY_ALL_POSTED_EMAIL signal row for the date", async () => {
      const insert = vi.fn().mockResolvedValue({ error: null });
      mockCreateClient.mockReturnValueOnce({
        from: fromReturning("match_fit_content_learning_signals", { insert }),
      });

      await recordDayAllPostedEmailSent("2026-08-20");

      expect(insert).toHaveBeenCalledWith({
        signal_type: "DAY_ALL_POSTED_EMAIL",
        post_id: null,
        meta_json: { postDate: "2026-08-20" },
      });
    });

    it("propagates an insert error from the record* helper", async () => {
      const insert = vi.fn().mockResolvedValue({ error: { message: "insert failed" } });
      mockCreateClient.mockReturnValueOnce({
        from: fromReturning("match_fit_content_learning_signals", { insert }),
      });

      await expect(recordDayScheduledEmailSent("2026-08-15")).rejects.toThrow("insert failed");
    });

    it("record* no-ops without a client when NI Brain is not configured", async () => {
      delete process.env.NI_BRAIN_SUPABASE_URL;

      await expect(recordDayScheduledEmailSent("2026-08-15")).resolves.toBeUndefined();
      await expect(recordDayAllPostedEmailSent("2026-08-15")).resolves.toBeUndefined();
      expect(mockCreateClient).not.toHaveBeenCalled();
    });
  });
});
