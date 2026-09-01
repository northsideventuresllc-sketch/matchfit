import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockHydrate } = vi.hoisted(() => ({
  mockHydrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydrate,
}));

import { callRunpodAxonV1, callRunpodAxonV1Provider } from "@/lib/ai-vault/runpod-axon-v1";
import { callMatchFitAi } from "@/lib/ai-vault/router";

const ENV_KEYS = [
  "RUNPOD_AXON_V1_ENDPOINT",
  "RUNPOD_AXON_V1_KEY",
  "NI_BRAIN_SUPABASE_URL",
  "NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_BACKUP",
  "ANTHROPIC_API_KEY",
] as const;

function clearAiVaultEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("RunPod AXON v1 tier — new provider, not deployed yet", () => {
  beforeEach(() => {
    clearAiVaultEnv();
    mockHydrate.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAiVaultEnv();
  });

  it("returns null with no network call when RUNPOD_AXON_V1_ENDPOINT / KEY are unset (current live state)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const text = await callRunpodAxonV1("system prompt", "user prompt");

    expect(text).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("callRunpodAxonV1Provider() reports a clean null result (never throws) when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRunpodAxonV1Provider({ system: "s", user: "u" });

    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.model).toBe("Qwen3-Coder-30B-A3B-Instruct");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs the missing-config warning only once per process, not on every call", async () => {
    // Isolated from the other tests in this file (which already trip the module-level
    // "warned once" flag) via a fresh module instance.
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const fresh = await import("@/lib/ai-vault/runpod-axon-v1");
    await fresh.callRunpodAxonV1("s", "u");
    await fresh.callRunpodAxonV1("s", "u");
    await fresh.callRunpodAxonV1("s", "u");

    expect(warnSpy.mock.calls.filter((call) => String(call[0]).includes("RunPod AXON v1")).length).toBe(1);
    warnSpy.mockRestore();
  });

  it("returns null cleanly (never throws) even if fetch is somehow reached and rejects", async () => {
    process.env.RUNPOD_AXON_V1_ENDPOINT = "https://example-runpod-endpoint.invalid/runsync";
    process.env.RUNPOD_AXON_V1_KEY = "test-key";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const text = await callRunpodAxonV1("s", "u");

    expect(text).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("callMatchFitAi() chain — RunPod tier is a no-op in current live behavior", () => {
  beforeEach(() => {
    clearAiVaultEnv();
    mockHydrate.mockClear();
    // Gemini primary configured so the chain has somewhere to land after AXON local +
    // RunPod AXON v1 both no-op (neither is configured yet).
    process.env.GEMINI_API_KEY = "AIza-test-key-for-router-fallthrough";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAiVaultEnv();
  });

  it("falls through AXON local -> RunPod AXON v1 (no-op) -> Gemini primary, exactly as before this change", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "gemini answered" }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMatchFitAi({ system: "You are a test.", user: "Say hi." });

    expect(result.text).toBe("gemini answered");
    expect(result.provider).toBe("gemini-primary");

    // Exactly one attempt logged per tier that actually ran before Gemini succeeded:
    // axon-local (no NI Brain config -> null, no network) then runpod-axon-v1 (no
    // RunPod config -> null, no network) then gemini-primary (succeeded).
    const providers = result.attempts.map((a) => a.provider);
    expect(providers).toEqual(["axon-local", "runpod-axon-v1", "gemini-primary"]);

    const runpodAttempt = result.attempts.find((a) => a.provider === "runpod-axon-v1");
    expect(runpodAttempt?.error).toBeTruthy();

    // Only Gemini's HTTP call should have hit the network — AXON local and RunPod AXON v1
    // both bailed out on missing config before any fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("generativelanguage.googleapis.com");
  });
});
