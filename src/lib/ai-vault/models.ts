import {
  CLAUDE_MODELS,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_FALLBACK_CHAIN,
} from "@/lib/ai-vault/constants";
import type { AiTaskComplexity } from "@/lib/ai-vault/types";

export function resolveClaudeModelForComplexity(
  complexity: AiTaskComplexity,
  override?: string,
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return CLAUDE_MODELS[complexity];
}

export function resolveGeminiModel(): string {
  return (
    process.env.GEMINI_CONTENT_CALENDAR_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

export function resolveGeminiModelChain(): string[] {
  const preferred = resolveGeminiModel();
  const chain = [preferred, ...GEMINI_MODEL_FALLBACK_CHAIN.filter((model) => model !== preferred)];
  return [...new Set(chain)];
}

export function isRetryableGeminiModelError(status: number): boolean {
  return status === 404 || status === 429 || status === 503;
}
