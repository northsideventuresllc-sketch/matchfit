import "server-only";

import { AI_VAULT_DEFAULT_TIMEOUT_MS } from "@/lib/ai-vault/constants";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveGeminiApiKeyChain } from "@/lib/ai-vault/keys";
import { resolveClaudeModelForComplexity } from "@/lib/ai-vault/models";
import { callAnthropicProvider, callGeminiProvider } from "@/lib/ai-vault/providers";
import type {
  AiVaultProviderId,
  MatchFitAiAttempt,
  MatchFitAiCallArgs,
  MatchFitAiCallResult,
} from "@/lib/ai-vault/types";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

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

  attempts.push({
    provider: "anthropic",
    model: claudeModel,
    error: anthropic.error,
  });

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

    attempts.push({
      provider: providerId,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
      error: gemini.error,
    });

    if (gemini.text) {
      return {
        text: gemini.text,
        provider: providerId,
        model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
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
