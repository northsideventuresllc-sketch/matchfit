import "server-only";

import {
  resolveAnthropicApiKey,
  resolveGeminiBackupApiKey,
  resolveGeminiPrimaryApiKey,
} from "@/lib/ai-vault/keys";
import type { AiVaultStatus } from "@/lib/ai-vault/types";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export async function getAiVaultStatusAsync(): Promise<AiVaultStatus> {
  await hydratePlatformEnvFromDatabase();
  return getAiVaultStatus();
}

export function getAiVaultStatus(): AiVaultStatus {
  const anthropic = Boolean(resolveAnthropicApiKey());
  const geminiPrimary = Boolean(resolveGeminiPrimaryApiKey());
  const geminiBackup = Boolean(resolveGeminiBackupApiKey());
  const configured = anthropic || geminiPrimary || geminiBackup;

  const parts: string[] = [];
  if (anthropic) parts.push("Claude primary (auto model by task complexity)");
  if (geminiPrimary) parts.push("Gemini primary fallback");
  if (geminiBackup) parts.push("Gemini backup fallback");
  if (!configured) {
    parts.push("Add ANTHROPIC_API_KEY and GEMINI_API_KEY to the AI Vault (platform_secrets).");
  }

  return {
    configured,
    anthropic,
    geminiPrimary,
    geminiBackup,
    message: parts.join(" · "),
  };
}
