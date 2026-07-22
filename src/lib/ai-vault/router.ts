import "server-only";

import { AI_VAULT_DEFAULT_TIMEOUT_MS } from "@/lib/ai-vault/constants";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveGeminiApiKeyChain } from "@/lib/ai-vault/keys";
import { resolveClaudeModelForComplexity, resolveGeminiModel } from "@/lib/ai-vault/models";
import { callAnthropicProvider, callGeminiProvider } from "@/lib/ai-vault/providers";
import type {
  AiVaultProviderId,
  MatchFitAiAttempt,
  MatchFitAiCallArgs,
  MatchFitAiCallResult,
} from "@/lib/ai-vault/types";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

async function callAnthropicFirst(
  args: MatchFitAiCallArgs,
  claudeModel: string,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  complexity: MatchFitAiCallResult["complexity"],
): Promise<MatchFitAiCallResult> {
  // Anthropic tool-calling (function calling) has no Gemini equivalent wired up here —
  // callers passing anthropicTools (e.g. outreach-ai.ts) must go straight to Anthropic.
  const attempts: MatchFitAiAttempt[] = [];

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

  const errors = attempts.map((a) => a.error).filter(Boolean);
  return {
    text: null,
    provider: null,
    model: null,
    complexity,
    usedFallback: attempts.some((a) => a.provider !== "anthropic"),
    error: errors.length
      ? errors.join(" → ")
      : "All AI providers failed (Anthropic, Gemini primary, Gemini backup).",
    attempts,
  };
}

async function callGeminiFirst(
  args: MatchFitAiCallArgs,
  claudeModel: string,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  complexity: MatchFitAiCallResult["complexity"],
): Promise<MatchFitAiCallResult> {
  const attempts: MatchFitAiAttempt[] = [];

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
        usedFallback: false,
        attempts,
      };
    }
  }

  // Free-tier Gemini exhausted/unavailable — fall back to paid Anthropic so the
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
      : "All AI providers failed (Gemini primary, Gemini backup, Anthropic).",
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

  // Tool-calling has no Gemini equivalent wired up in this router — keep those on
  // Anthropic-first so function-calling callers (e.g. outreach-ai.ts) don't silently
  // lose structured tool output. Everything else tries free-tier Gemini first.
  if (args.anthropicTools && args.anthropicTools.length > 0) {
    return callAnthropicFirst(args, claudeModel, maxTokens, temperature, timeoutMs, complexity);
  }
  return callGeminiFirst(args, claudeModel, maxTokens, temperature, timeoutMs, complexity);
}
