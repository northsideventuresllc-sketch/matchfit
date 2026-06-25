/** Canonical platform_secrets / env keys for the Northside AI Vault. */
export const AI_VAULT_SECRET_KEYS = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  geminiPrimaryApiKey: "GEMINI_API_KEY",
  geminiBackupApiKey: "GEMINI_API_KEY_BACKUP",
  geminiModel: "GEMINI_MODEL",
  geminiContentCalendarModel: "GEMINI_CONTENT_CALENDAR_MODEL",
} as const;

export const CLAUDE_MODELS = {
  simple: "claude-haiku-4-5",
  standard: "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const AI_VAULT_DEFAULT_TIMEOUT_MS = 45_000;
export const AI_VAULT_ANTHROPIC_MAX_ATTEMPTS = 2;
