import "server-only";

import {
  callGeminiProvider,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from "@/lib/ai-vault/providers";
import { resolveGeminiApiKeyChain } from "@/lib/ai-vault/keys";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export type GeminiCallResult = {
  text: string | null;
  error?: string;
  provider?: "gemini-primary" | "gemini-backup";
};

export {
  isValidGeminiApiKey,
  resolveGeminiPrimaryApiKey as resolveGeminiApiKey,
  resolveGeminiBackupApiKey,
  resolveGeminiApiKeyChain,
} from "@/lib/ai-vault/keys";
export { resolveGeminiModel } from "@/lib/ai-vault/models";

export function isGeminiFallbackConfigured(): boolean {
  return resolveGeminiApiKeyChain().length > 0;
}

/** Tries Gemini primary, then backup key from the AI Vault. */
export async function callGeminiGenerateContent(args: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}): Promise<GeminiCallResult> {
  await hydratePlatformEnvFromDatabase();
  const chain = resolveGeminiApiKeyChain();
  if (!chain.length) {
    return { text: null, error: "GEMINI_API_KEY is not configured for fallback." };
  }

  let lastError: string | undefined;
  for (const entry of chain) {
    const providerId = entry.slot === "primary" ? "gemini-primary" : "gemini-backup";
    const result = await callGeminiProvider({
      system: args.system,
      user: args.user,
      apiKey: entry.key,
      providerId,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.55,
      jsonMode: args.jsonMode ?? false,
      timeoutMs: args.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
    });
    if (result.text) {
      return { text: result.text, provider: providerId };
    }
    lastError = result.error;
  }

  return { text: null, error: lastError ?? "Gemini fallback failed." };
}
