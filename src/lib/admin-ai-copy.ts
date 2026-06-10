type AdminAiProviderId = "anthropic" | "openai";

/** How Anthropic/OpenAI keys are loaded in production (see hydrate-platform-env). */
export const ADMIN_AI_KEYS_HELP =
  "Anthropic and OpenAI keys load from platform_secrets at runtime (or ANTHROPIC_API_KEY / OPENAI_API_KEY in env). Rotate via POST /api/admin/ai-config without redeploying.";

export const OUTREACH_HQ_SUMMARY =
  "Daily cold outreach for external fitness pros — not signed-up Match Fit trainers. Use the Match Fit trainers tab for your live roster.";

export const OUTREACH_HQ_GENERATE_HELP =
  "Anthropic web search finds verified public Instagram, Facebook, and email contacts, skips leads already in Outreach HQ or registered on Match Fit, and drafts personalized outreach with today's invite tail.";

export const OUTREACH_HQ_OPENAI_FALLBACK =
  "OpenAI is configured but cannot web-search — it may invent handles. Anthropic is required for the same verified discovery as Claude Cowork.";

export const OUTREACH_HQ_ANTHROPIC_WEB_SEARCH =
  "Anthropic web search is active — Outreach HQ will only save fitness pros verified from live public web results.";

export const OUTREACH_HQ_PURGE_HELP =
  "Remove archived (soft-deleted) outreach rows from earlier memory-only runs, then regenerate with Anthropic web search.";

export const OUTREACH_REGISTERED_TRAINERS_HELP =
  "Signed-up Match Fit trainers (read-only here). Manage accounts from the admin dashboard. Cold outreach generation skips these handles automatically.";

export const ADMIN_ASSISTANT_SUMMARY =
  "Ask questions about traffic, sign-ups, goals, and platform health. Uses the same Anthropic/OpenAI keys as Outreach HQ and the content calendar.";

export function adminAiNotConfiguredMessage(): string {
  return `No AI provider configured. ${ADMIN_AI_KEYS_HELP}`;
}

export function adminAiConfiguredMessage(provider: AdminAiProviderId, model: string): string {
  const name = provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI";
  return `${name} is configured (${model}). Keys load from platform_secrets or env.`;
}

export function outreachAiProviderHint(provider: AdminAiProviderId | "none" | "openai" | "anthropic"): string {
  if (provider === "openai") {
    return " OpenAI fallback cannot web-search — configure Anthropic for verified real-profile discovery.";
  }
  if (provider === "none") {
    return ` ${ADMIN_AI_KEYS_HELP}`;
  }
  return "";
}

export function contentCalendarAiNotConfiguredMessage(): string {
  return `Add Anthropic or OpenAI for post generation. ${ADMIN_AI_KEYS_HELP}`;
}
