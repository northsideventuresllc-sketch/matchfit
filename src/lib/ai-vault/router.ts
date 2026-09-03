import "server-only";

import { AI_VAULT_DEFAULT_TIMEOUT_MS } from "@/lib/ai-vault/constants";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveGeminiApiKeyChain, resolveOpenRouterApiKey } from "@/lib/ai-vault/keys";
import { resolveClaudeModelForComplexity, resolveGeminiModel } from "@/lib/ai-vault/models";
import { callAnthropicProvider, callGeminiProvider, callOpenRouterProvider } from "@/lib/ai-vault/providers";
import { callAxonLocalProvider } from "@/lib/ai-vault/axon-local";
import { callRunpodAxonV1Provider } from "@/lib/ai-vault/runpod-axon-v1";
import type {
  AiVaultProviderId,
  MatchFitAiAttempt,
  MatchFitAiCallArgs,
  MatchFitAiCallResult,
} from "@/lib/ai-vault/types";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { logLlmUsage } from "@/lib/ai-vault/usage-ledger";
import type { ProviderCallResult } from "@/lib/ai-vault/providers";

/**
 * AXON-EVERYWHERE-PROJECT (2026-08-05, tier order extended 2026-08-20 per JB direct
 * order; OpenRouter free tier inserted 2026-09-03, Phase 3 / Decision #1721): the ONE
 * canonical tier order, binding across every NVG repo — AXON local (Mac mini Ollama) ->
 * RunPod AXON v1 (NVG's own fine-tuned model, not deployed yet, see NI-Brain Decision
 * #1261) -> OpenRouter free models -> Gemini primary -> Gemini backup -> Anthropic (paid,
 * last resort) — locked in Decision #598 item 11 / #619, extended by the 2026-08-20 and
 * 2026-09-03 orders. Every path below tries AXON-local, then RunPod AXON v1, first; where
 * AXON structurally can't do the job (live web search — Ollama has no internet access or
 * tool execution), that is documented explicitly at the call site, never silently
 * skipped. RunPod AXON v1 returns null immediately (no network call) until
 * `RUNPOD_AXON_V1_ENDPOINT` / `RUNPOD_AXON_V1_KEY` are configured, so this tier is a
 * no-op until the pod is live. OpenRouter is likewise a no-op until `OPENROUTER_API_KEY`
 * is configured.
 */
/**
 * Fire-and-forget usage log for one successful provider call. Never awaited by callers —
 * logging must never add latency to, or ever break, the live AI reply path.
 */
function logProviderUsage(
  provider: string,
  result: Pick<ProviderCallResult, "model" | "usage" | "ms">,
  args: MatchFitAiCallArgs,
) {
  if (!result.usage) return; // nothing reported — don't write a row of nulls
  logLlmUsage({
    provider,
    model: result.model,
    tokensIn: result.usage.tokensIn,
    tokensOut: result.usage.tokensOut,
    ms: result.ms,
    product: args.kind,
    meta: { complexity: args.complexity },
  });
}

async function attemptAxonLocal(
  args: MatchFitAiCallArgs,
  attempts: MatchFitAiAttempt[],
): Promise<string | null> {
  const axon = await callAxonLocalProvider({ system: args.system, user: args.user });
  attempts.push({ provider: "axon-local", model: axon.model ?? "axon-ornith:latest", error: axon.error });
  if (axon.text) logProviderUsage("ollama", axon, args);
  return axon.text;
}

/** RunPod AXON v1 — see docstring above. Returns null (no-op) until deployed. */
async function attemptRunpodAxonV1(
  args: MatchFitAiCallArgs,
  attempts: MatchFitAiAttempt[],
): Promise<string | null> {
  const runpod = await callRunpodAxonV1Provider({ system: args.system, user: args.user });
  attempts.push({
    provider: "runpod-axon-v1",
    model: runpod.model ?? "Qwen3-Coder-30B-A3B-Instruct",
    error: runpod.error,
  });
  if (runpod.text) logProviderUsage("runpod", runpod, args);
  return runpod.text;
}

/**
 * OpenRouter FREE tier — Phase 3 (Decision #1721): sits between RunPod AXON v1 and
 * Gemini. No-op (returns null immediately) when OPENROUTER_API_KEY is not configured.
 */
async function attemptOpenRouter(
  args: MatchFitAiCallArgs,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  attempts: MatchFitAiAttempt[],
): Promise<string | null> {
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    attempts.push({ provider: "openrouter", model: "unconfigured", error: "OPENROUTER_API_KEY is not configured." });
    return null;
  }
  const openrouter = await callOpenRouterProvider({
    system: args.system,
    user: args.user,
    apiKey,
    maxTokens,
    temperature,
    timeoutMs,
  });
  attempts.push({ provider: "openrouter", model: openrouter.model ?? "unknown", error: openrouter.error });
  if (openrouter.text) logProviderUsage("openrouter", openrouter, args);
  return openrouter.text;
}

/**
 * Tool-calling path (e.g. outreach-ai.ts's lead finder, which needs live web search).
 * AXON-local (Ollama, no internet access, no tool execution) is asked first but told to
 * self-report when it cannot do live search rather than fabricate results — protects the
 * live outreach pipeline from hallucinated leads while still keeping AXON first in the
 * chain. Gemini gets Google Search grounding (the real capability match for Anthropic's
 * web_search tool) before falling to paid Anthropic last.
 */
async function callAnthropicFirst(
  args: MatchFitAiCallArgs,
  claudeModel: string,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  complexity: MatchFitAiCallResult["complexity"],
): Promise<MatchFitAiCallResult> {
  const attempts: MatchFitAiAttempt[] = [];
  const usesLiveSearch = Boolean(args.anthropicTools && args.anthropicTools.length > 0);

  const axonSystem = usesLiveSearch
    ? `${args.system}\n\nYou do not have live internet access. If this task requires real-time web search or verifying current public information, respond with exactly: NO_LIVE_SEARCH. Never invent or guess company names, emails, or facts.`
    : args.system;
  const axonText = await attemptAxonLocal({ ...args, system: axonSystem }, attempts);
  if (axonText && axonText.trim() !== "NO_LIVE_SEARCH") {
    return {
      text: axonText,
      provider: "axon-local",
      model: "axon-ornith:latest",
      complexity,
      usedFallback: false,
      attempts,
    };
  }

  const runpodText = await attemptRunpodAxonV1({ ...args, system: axonSystem }, attempts);
  if (runpodText && runpodText.trim() !== "NO_LIVE_SEARCH") {
    return {
      text: runpodText,
      provider: "runpod-axon-v1",
      model: "Qwen3-Coder-30B-A3B-Instruct",
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  // OpenRouter has no live-search capability either — same NO_LIVE_SEARCH self-report guard.
  const openrouterText = await attemptOpenRouter({ ...args, system: axonSystem }, maxTokens, temperature, timeoutMs, attempts);
  if (openrouterText && openrouterText.trim() !== "NO_LIVE_SEARCH") {
    return {
      text: openrouterText,
      provider: "openrouter",
      model: attempts[attempts.length - 1]?.model ?? "openrouter",
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  const geminiKeys = resolveGeminiApiKeyChain();
  for (const entry of geminiKeys) {
    const providerId: AiVaultProviderId =
      entry.slot === "primary" ? "gemini-primary" : "gemini-backup";
    const gemini = await callGeminiProvider({
      system: args.system,
      user: args.user,
      apiKey: entry.key,
      providerId,
      maxTokens,
      temperature,
      jsonMode: args.jsonMode ?? false,
      timeoutMs,
      groundWithSearch: usesLiveSearch,
    });

    const geminiModel = gemini.model ?? resolveGeminiModel();
    attempts.push({ provider: providerId, model: geminiModel, error: gemini.error });

    if (gemini.text) {
      logProviderUsage(providerId, { ...gemini, model: geminiModel }, args);
      return {
        text: gemini.text,
        provider: providerId,
        model: geminiModel,
        complexity,
        usedFallback: true,
        attempts,
      };
    }
  }

  const anthropic = await callAnthropicProvider({
    system: args.system,
    user: args.user,
    model: claudeModel,
    maxTokens,
    temperature,
    timeoutMs,
    tools: args.anthropicTools,
    priorTurns: args.priorTurns,
  });

  attempts.push({ provider: "anthropic", model: claudeModel, error: anthropic.error });

  if (anthropic.text) {
    logProviderUsage("anthropic", anthropic, args);
    return {
      text: anthropic.text,
      provider: "anthropic",
      model: claudeModel,
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  const errors = attempts.map((a) => a.error).filter(Boolean);
  return {
    text: null,
    provider: null,
    model: null,
    complexity,
    usedFallback: true,
    error: errors.length
      ? errors.join(" → ")
      : "All AI providers failed (AXON local, RunPod AXON v1, OpenRouter free, Gemini primary, Gemini backup, Anthropic).",
    attempts,
  };
}

/**
 * Standard (non-tool-calling) path: AXON-local -> RunPod AXON v1 -> Gemini primary ->
 * Gemini backup -> Anthropic last.
 */
async function callGeminiFirst(
  args: MatchFitAiCallArgs,
  claudeModel: string,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  complexity: MatchFitAiCallResult["complexity"],
): Promise<MatchFitAiCallResult> {
  const attempts: MatchFitAiAttempt[] = [];

  const axonText = await attemptAxonLocal(args, attempts);
  if (axonText) {
    return {
      text: axonText,
      provider: "axon-local",
      model: "axon-ornith:latest",
      complexity,
      usedFallback: false,
      attempts,
    };
  }

  const runpodText = await attemptRunpodAxonV1(args, attempts);
  if (runpodText) {
    return {
      text: runpodText,
      provider: "runpod-axon-v1",
      model: "Qwen3-Coder-30B-A3B-Instruct",
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  const openrouterText = await attemptOpenRouter(args, maxTokens, temperature, timeoutMs, attempts);
  if (openrouterText) {
    return {
      text: openrouterText,
      provider: "openrouter",
      model: attempts[attempts.length - 1]?.model ?? "openrouter",
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  const geminiKeys = resolveGeminiApiKeyChain();
  for (const entry of geminiKeys) {
    const providerId: AiVaultProviderId =
      entry.slot === "primary" ? "gemini-primary" : "gemini-backup";
    const gemini = await callGeminiProvider({
      system: args.system,
      user: args.user,
      apiKey: entry.key,
      providerId,
      maxTokens,
      temperature,
      jsonMode: args.jsonMode ?? false,
      timeoutMs,
    });

    const geminiModel = gemini.model ?? resolveGeminiModel();
    attempts.push({ provider: providerId, model: geminiModel, error: gemini.error });

    if (gemini.text) {
      logProviderUsage(providerId, { ...gemini, model: geminiModel }, args);
      return {
        text: gemini.text,
        provider: providerId,
        model: geminiModel,
        complexity,
        usedFallback: true,
        attempts,
      };
    }
  }

  // Free-tier AXON/OpenRouter/Gemini exhausted/unavailable — fall back to paid Anthropic so the
  // request still completes instead of failing outright.
  const anthropic = await callAnthropicProvider({
    system: args.system,
    user: args.user,
    model: claudeModel,
    maxTokens,
    temperature,
    timeoutMs,
    tools: args.anthropicTools,
    priorTurns: args.priorTurns,
  });

  attempts.push({ provider: "anthropic", model: claudeModel, error: anthropic.error });

  if (anthropic.text) {
    logProviderUsage("anthropic", anthropic, args);
    return {
      text: anthropic.text,
      provider: "anthropic",
      model: claudeModel,
      complexity,
      usedFallback: true,
      attempts,
    };
  }

  const errors = attempts.map((a) => a.error).filter(Boolean);
  return {
    text: null,
    provider: null,
    model: null,
    complexity,
    usedFallback: true,
    error: errors.length
      ? errors.join(" → ")
      : "All AI providers failed (AXON local, RunPod AXON v1, OpenRouter free, Gemini primary, Gemini backup, Anthropic).",
    attempts,
  };
}

export async function callMatchFitAi(args: MatchFitAiCallArgs): Promise<MatchFitAiCallResult> {
  await hydratePlatformEnvFromDatabase();

  const complexity = inferTaskComplexity({
    system: args.system,
    user: args.user,
    maxTokens: args.maxTokens,
    kind: args.kind,
    complexity: args.complexity,
  });
  const claudeModel = resolveClaudeModelForComplexity(complexity, args.modelOverride);
  const maxTokens = args.maxTokens ?? 2000;
  const temperature = args.temperature ?? 0.55;
  const timeoutMs = args.timeoutMs ?? AI_VAULT_DEFAULT_TIMEOUT_MS;

  // Tool-calling (live web search) callers (e.g. outreach-ai.ts) go through
  // callAnthropicFirst, which still tries AXON-local first — see its docstring for why
  // that path treats "can't do live search" as an explicit, non-silent fall-through.
  if (args.anthropicTools && args.anthropicTools.length > 0) {
    return callAnthropicFirst(args, claudeModel, maxTokens, temperature, timeoutMs, complexity);
  }
  return callGeminiFirst(args, claudeModel, maxTokens, temperature, timeoutMs, complexity);
}
