/** Canonical platform_secrets / env keys for the Northside AI Vault. */
export const AI_VAULT_SECRET_KEYS = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  geminiPrimaryApiKey: "GEMINI_API_KEY",
  geminiBackupApiKey: "GEMINI_API_KEY_BACKUP",
  geminiModel: "GEMINI_MODEL",
  geminiContentCalendarModel: "GEMINI_CONTENT_CALENDAR_MODEL",
  openRouterApiKey: "OPENROUTER_API_KEY",
} as const;

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * UNVERIFIED fallback only — used when the live NI-Brain query (router_models joined to
 * router_routes where route='openrouter', cost_tier=0, enabled) returns no rows. Not
 * confirmed available/free at read time; replace with the live list whenever possible.
 */
export const OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
] as const;

export const CLAUDE_MODELS = {
  simple: "claude-haiku-4-5",
  standard: "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Tried in order when the configured Gemini model is unavailable or quota-blocked. */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

export const AI_VAULT_DEFAULT_TIMEOUT_MS = 45_000;
export const AI_VAULT_ANTHROPIC_MAX_ATTEMPTS = 2;
