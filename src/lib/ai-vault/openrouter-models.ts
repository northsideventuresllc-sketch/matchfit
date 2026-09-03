import "server-only";

/**
 * AXON-EVERYWHERE-PROJECT Phase 3 (Decision #1721): the free-model list for the
 * OpenRouter tier is read live from NI-Brain (router_models joined to router_routes,
 * route='openrouter', cost_tier=0, enabled=true) — never hardcoded as the primary source.
 * Falls back to OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED only when that query returns no
 * rows or NI-Brain is unreachable.
 */

import { OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED } from "@/lib/ai-vault/constants";

const NI_BRAIN_QUERY_TIMEOUT_MS = 3_000;

function resolveSupabaseUrl(): string | null {
  return process.env.NI_BRAIN_SUPABASE_URL?.trim() || null;
}

function resolveSupabaseKey(): string | null {
  return process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export async function resolveOpenRouterFreeModelChain(): Promise<string[]> {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();
  if (!supabaseUrl || !supabaseKey) return [...OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED];

  try {
    const url =
      `${supabaseUrl}/rest/v1/router_models?select=model,router_routes!inner(name)` +
      `&router_routes.name=eq.openrouter&cost_tier=eq.0&enabled=eq.true`;
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(NI_BRAIN_QUERY_TIMEOUT_MS),
    });
    if (!res.ok) return [...OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED];
    const rows = (await res.json()) as Array<{ model?: string }>;
    const models = Array.isArray(rows) ? rows.map((r) => r.model).filter((m): m is string => Boolean(m)) : [];
    return models.length ? models : [...OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED];
  } catch {
    return [...OPENROUTER_FREE_MODEL_FALLBACK_UNVERIFIED];
  }
}
