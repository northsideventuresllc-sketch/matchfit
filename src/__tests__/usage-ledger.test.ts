import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * BUILD-AXON-AGENTS-FIX-BUNDLE-0923 (c): regression coverage for two confirmed bugs that
 * kept axon_cost_ledger empty:
 *
 * 1. logLlmUsageAsync used to send `total_tokens` in the insert body. That column is a
 *    Postgres GENERATED ALWAYS column on the live table — sending it makes PostgREST
 *    reject the WHOLE insert (428C9), so every single call silently failed. Verified live
 *    against the real table via AXON/lib/axon-router-core.mjs's twin function before this
 *    fix (HTTP 400 / 428C9), and confirmed fixed by removing the field (row landed with
 *    total_tokens auto-computed by Postgres). This suite proves the field is never sent.
 *
 * 2. router.ts's logProviderUsage silently skipped logging entirely whenever a provider
 *    returned text with no `usage` object, making "provider didn't report usage" and "no
 *    call happened" indistinguishable in the ledger. Now it always logs, tagging
 *    meta.usage_missing so the two cases are distinguishable.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NI_BRAIN_SUPABASE_URL = "https://kxijunwgbrlfzvgkhklo.supabase.co";
  process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usage-ledger: axon_cost_ledger insert shape", () => {
  it("never sends total_tokens (it is a Postgres GENERATED ALWAYS column)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { logLlmUsageAsync } = await import("@/lib/ai-vault/usage-ledger");

    const ok = await logLlmUsageAsync({
      provider: "gemini-primary",
      model: "gemini-2.5-flash",
      tokensIn: 120,
      tokensOut: 45,
      ms: 812,
      product: "coach-matching",
      meta: { complexity: "standard" },
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/rest/v1/axon_cost_ledger");
    const body = JSON.parse(init.body as string);
    expect("total_tokens" in body).toBe(false);
    expect(body.input_tokens).toBe(120);
    expect(body.output_tokens).toBe(45);
    expect(body.provider).toBe("gemini-primary");
  });

  it("still writes a row (nulls, not a skip) when no token counts are given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { logLlmUsageAsync } = await import("@/lib/ai-vault/usage-ledger");
    const ok = await logLlmUsageAsync({ provider: "anthropic" });

    expect(ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect("total_tokens" in body).toBe(false);
    expect(body.input_tokens).toBeNull();
    expect(body.output_tokens).toBeNull();
  });
});

describe("router: logProviderUsage always logs, tags usage_missing", () => {
  it("logs with usage_missing:false when the provider reported usage", async () => {
    const logLlmUsage = vi.fn();
    vi.doMock("@/lib/ai-vault/usage-ledger", () => ({ logLlmUsage }));

    const { logProviderUsage } = await import("@/lib/ai-vault/router");
    logProviderUsage(
      "gemini-primary",
      { model: "gemini-2.5-flash", usage: { tokensIn: 10, tokensOut: 20 }, ms: 500 },
      { kind: "chat", complexity: "standard" } as never,
    );

    expect(logLlmUsage).toHaveBeenCalledTimes(1);
    const entry = logLlmUsage.mock.calls[0]![0];
    expect(entry.tokensIn).toBe(10);
    expect(entry.tokensOut).toBe(20);
    expect(entry.meta.usage_missing).toBe(false);
  });

  it("still logs (does not skip) with usage_missing:true when usage is absent", async () => {
    const logLlmUsage = vi.fn();
    vi.doMock("@/lib/ai-vault/usage-ledger", () => ({ logLlmUsage }));

    const { logProviderUsage } = await import("@/lib/ai-vault/router");
    logProviderUsage(
      "axon-local",
      { model: "axon-ornith:latest", usage: undefined, ms: 300 },
      { kind: "chat", complexity: "simple" } as never,
    );

    expect(logLlmUsage).toHaveBeenCalledTimes(1);
    const entry = logLlmUsage.mock.calls[0]![0];
    expect(entry.tokensIn).toBeUndefined();
    expect(entry.tokensOut).toBeUndefined();
    expect(entry.meta.usage_missing).toBe(true);
  });
});
