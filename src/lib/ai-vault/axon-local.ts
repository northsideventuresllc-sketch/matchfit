import "server-only";

import type { ProviderCallResult } from "@/lib/ai-vault/providers";

/**
 * AXON-EVERYWHERE-PROJECT (2026-08-05): the tunnel for cloud -> Mac-mini AXON-local calls.
 * No new infra — reuses nvg_mini_jobs (Supabase queue the Mac mini already polls via
 * nvg-mini-runner.py, proven live for git relay + real generations 2026-08-05, Decision
 * #599 / Learning #3585) as an async request/response bridge to the Ollama server on the
 * mini. Same pattern already shipped in the axon and northside-intelligence repos.
 *
 * Returns `null` on any failure/timeout so callers fall through to the next tier
 * (Gemini main -> Gemini backup -> Anthropic last) without throwing.
 */

const MINI_RELAY_MODEL = "axon-ornith:latest";
const MINI_RELAY_MAX_WAIT_MS = 45_000;
const MINI_RELAY_POLL_MS = 2_500;
const MINI_RELAY_CMD_TIMEOUT_S = 40;

function sbHeaders(supabaseKey: string) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
}

function resolveSupabaseUrl(): string | null {
  return process.env.NI_BRAIN_SUPABASE_URL?.trim() || null;
}

function resolveSupabaseKey(): string | null {
  return process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

/**
 * Try AXON's own local model (Mac mini, Ollama) via the mini job-queue relay.
 * Returns null on any missing config / failure / timeout — never throws.
 */
export async function callAxonLocal(system: string, user: string): Promise<string | null> {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();
  if (!supabaseUrl || !supabaseKey) return null;

  const prompt = `${system}\n\nUser: ${user}\nAssistant:`;
  const ollamaBody = JSON.stringify({ model: MINI_RELAY_MODEL, prompt, stream: false });
  const cmd = `curl -s -m ${MINI_RELAY_CMD_TIMEOUT_S} http://localhost:11434/api/generate -d ${JSON.stringify(
    ollamaBody,
  )}`;

  let jobId: number | null = null;
  try {
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/nvg_mini_jobs`, {
      method: "POST",
      headers: { ...sbHeaders(supabaseKey), Prefer: "return=representation" },
      body: JSON.stringify({
        kind: "shell",
        title: "matchfit-axon-local-relay",
        payload: { cmd, timeout: MINI_RELAY_CMD_TIMEOUT_S + 5 },
        status: "queued",
      }),
    });
    if (!insertRes.ok) return null;
    const rows = (await insertRes.json()) as Array<{ id?: number }> | { id?: number };
    jobId = Array.isArray(rows) ? rows[0]?.id ?? null : rows?.id ?? null;
  } catch {
    return null;
  }
  if (!jobId) return null;

  const deadline = Date.now() + MINI_RELAY_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, MINI_RELAY_POLL_MS));
    try {
      const pollRes = await fetch(
        `${supabaseUrl}/rest/v1/nvg_mini_jobs?id=eq.${jobId}&select=status,result,error`,
        { headers: { ...sbHeaders(supabaseKey), Accept: "application/json" } },
      );
      if (!pollRes.ok) continue;
      const rows = (await pollRes.json()) as Array<{
        status?: string;
        result?: { stdout?: string };
      }>;
      const row = rows?.[0];
      if (!row) continue;

      if (row.status === "failed") return null;
      if (row.status !== "done") continue;

      const stdout = row.result?.stdout;
      if (!stdout) return null;
      try {
        const parsed = JSON.parse(stdout) as { response?: string };
        const text = typeof parsed.response === "string" ? parsed.response.trim() : null;
        return text || null;
      } catch {
        return null;
      }
    } catch {
      // transient poll error — keep trying until deadline
    }
  }
  return null; // timed out — caller falls through to the next tier, mini job keeps running
}

/** Same shape as the other ai-vault providers so router.ts can use it interchangeably. */
export async function callAxonLocalProvider(args: {
  system: string;
  user: string;
}): Promise<ProviderCallResult> {
  const text = await callAxonLocal(args.system, args.user).catch(() => null);
  if (!text) {
    return { text: null, error: "AXON local (Mac mini) unavailable or returned no text.", model: MINI_RELAY_MODEL };
  }
  return { text, model: MINI_RELAY_MODEL };
}
