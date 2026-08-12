import "server-only";

import { AI_VAULT_DEFAULT_TIMEOUT_MS } from "@/lib/ai-vault/constants";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveGeminiApiKeyChain } from "@/lib/ai-vault/keys";
import { resolveClaudeModelForComplexity, resolveGeminiModel } from "@/lib/ai-vault/models";
import { callAnthropicProvider, callGeminiProvider } from "@/lib/ai-vault/providers";
import { callAxonLocalProvider } from "@/lib/ai-vault/axon-local";
import type {
  AiVaultProviderId,
  MatchFitAiAttempt,
  MatchFitAiCallArgs,
  MatchFitAiCallResult,
} from "@/lib/ai-vault/types";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

/**
 * AXON-EVERYWHERE-PROJECT (2026-08-05): tier order per JB is AXON local (Mac mini) ->
 * Gemini main -> Gemini backup -> Anthropic (paid, last resort) — locked in Decision
 * #598 item 11 / #619. Every path below tries AXON-local first; where AXON structurally
 * can't do the job (live web search — Ollama has no internet access or tool execution),
 * that is documented explicitly at the call site, never silently skipped.
 */
async function attemptAxonLocal(
  args: MatchFitAiCallArgs,
  attempts: MatchFitAiAttempt[],
): Promise<string | null> {
  const axon = await callAxonLocalProvider({ system: args.system, user: args.user });
  attempts.push({ provider: "axon-local", model: axon.model ?? "axon-ornith:latest", error: axon.error });
  return axon.text;
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
      : "All AI providers failed (AXON local, Gemini primary, Gemini backup, Anthropic).",
    attempts,
  };
}

/** Standard (non-tool-calling) path: AXON-local -> Gemini primary -> Gemini backup -> Anthropic last. */
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

  // Free-tier AXON/Gemini exhausted/unavailable — fall back to paid Anthropic so the
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
      : "All AI providers failed (AXON local, Gemini primary, Gemini backup, Anthropic).",
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
