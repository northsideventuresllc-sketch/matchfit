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
 *
 * Refreshed 2026-09-16 (fixer session, ticket EXEC free-chain-hits-paid): the previous
 * list (meta-llama/llama-3.1-8b-instruct:free, google/gemma-2-9b-it:free,
 * mistralai/mistral-7b-instruct:free) is NOT in OpenRouter's live /api/v1/models free
 * catalog and 404s on every call. Swapped for three IDs confirmed present in that live
 * catalog on 2026-09-16, matching nv-vault scripts/lib/axon-llm.mjs's corrected list.
 * NOTE: OpenRouter's free tier is a single account-wide ~50-requests/day cap, not
 * per-model — a longer list does NOT add daily budget, it only helps when one specific
 * model is individually removed/overloaded while the account cap still has room.
 */
export const OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
  "google/gemma-4-31b-it:free",
] as const;

export const CLAUDE_MODELS = {
  simple: "claude-haiku-4-5",
  standard: "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Tried in order when the configured Gemini model is unavailable or quota-blocked.
 * `gemini-2.0-flash` was removed 2026-09-16: Google retired it (404 on live
 * generativelanguage ListModels/generateContent, confirmed 2026-09-07), so keeping it
 * in the chain only burned a guaranteed-404 call before falling through toward paid.
 * Both entries below are confirmed live.
 */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export const AI_VAULT_DEFAULT_TIMEOUT_MS = 45_000;
export const AI_VAULT_ANTHROPIC_MAX_ATTEMPTS = 2;
