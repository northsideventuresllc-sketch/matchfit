import { AI_VAULT_SECRET_KEYS } from "@/lib/ai-vault/constants";

export function isValidAnthropicApiKey(key: string | null | undefined): boolean {
  return Boolean(key?.trim().startsWith("sk-ant-"));
}

export function isValidGeminiApiKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
}

export function resolveAnthropicApiKey(): string | null {
  const key = process.env[AI_VAULT_SECRET_KEYS.anthropicApiKey]?.trim();
  return isValidAnthropicApiKey(key) ? key! : null;
}

export function resolveGeminiPrimaryApiKey(): string | null {
  for (const envKey of [
    AI_VAULT_SECRET_KEYS.geminiPrimaryApiKey,
    "GOOGLE_GEMINI_API_KEY",
    "GOOGLE_API_KEY",
  ] as const) {
    const value = process.env[envKey]?.trim();
    if (isValidGeminiApiKey(value)) return value!;
  }
  return null;
}

export function resolveGeminiBackupApiKey(): string | null {
  const backup = process.env[AI_VAULT_SECRET_KEYS.geminiBackupApiKey]?.trim();
  if (isValidGeminiApiKey(backup)) return backup!;
  return null;
}

export function resolveGeminiApiKeyChain(): Array<{ slot: "primary" | "backup"; key: string }> {
  const chain: Array<{ slot: "primary" | "backup"; key: string }> = [];
  const primary = resolveGeminiPrimaryApiKey();
  const backup = resolveGeminiBackupApiKey();
  if (primary) chain.push({ slot: "primary", key: primary });
  if (backup && backup !== primary) chain.push({ slot: "backup", key: backup });
  return chain;
}
