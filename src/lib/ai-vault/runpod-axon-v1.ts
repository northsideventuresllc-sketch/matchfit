import "server-only";

import type { ProviderCallResult } from "@/lib/ai-vault/providers";

/**
 * AXON-EVERYWHERE-PROJECT / JB direct order 2026-08-20: tier 2 in the canonical AI
 * Vault chain — AXON v1, NVG's own fine-tuned model (base: Qwen3-Coder-30B-A3B-Instruct,
 * per NI-Brain Decision #1261), hosted on RunPod (RTX A6000 48GB, Community Cloud).
 *
 * RunPod GPU hosting is PAID, not free, and is DISABLED BY DEFAULT until JB funds it
 * (NI-Brain Decision #2001, 2026-09-24 — corrects earlier wording that called this tier
 * "free"). Even if `RUNPOD_AXON_V1_ENDPOINT` / `RUNPOD_AXON_V1_KEY` are set, this tier
 * stays skipped unless `AXON_ENABLE_RUNPOD=1` is also set — a config leak alone can never
 * trigger paid spend. This provider is wired into the chain now so router.ts only needs
 * the endpoint/key added to the AI Vault (`platform_secrets` / `ni_platform_secrets`) plus
 * `AXON_ENABLE_RUNPOD=1` once the pod is funded and live — no code change at that point.
 *
 * Same contract shape as `callAxonLocalProvider`: returns `null` on ANY failure, timeout,
 * disabled state, or missing config — never throws — so callMatchFitAi() falls through to
 * Gemini primary exactly as if this tier didn't exist. Missing config / disabled state is
 * logged once per process, not on every call, and never triggers a network request.
 */

const RUNPOD_AXON_V1_MODEL = "Qwen3-Coder-30B-A3B-Instruct";
const RUNPOD_AXON_V1_TIMEOUT_MS = 45_000;

let warnedMissingConfig = false;

function resolveRunpodEndpoint(): string | null {
  return process.env.RUNPOD_AXON_V1_ENDPOINT?.trim() || null;
}

function resolveRunpodKey(): string | null {
  return process.env.RUNPOD_AXON_V1_KEY?.trim() || null;
}

/** RunPod GPU hosting is paid — this tier never fires unless explicitly opted in. */
function runpodEnabled(): boolean {
  return process.env.AXON_ENABLE_RUNPOD === "1";
}

type RunpodUsage = { prompt_tokens?: number; completion_tokens?: number };

type RunpodAxonV1Response = {
  output?: {
    text?: string;
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    usage?: RunpodUsage;
  };
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  usage?: RunpodUsage;
};

export type RunpodAxonV1Result = {
  text: string | null;
  usage?: { tokensIn?: number; tokensOut?: number };
};

/**
 * Try NVG's own RunPod-hosted AXON v1 model.
 * Returns null on any missing config / failure / timeout — never throws.
 */
export async function callRunpodAxonV1(system: string, user: string): Promise<string | null> {
  const result = await callRunpodAxonV1WithUsage(system, user);
  return result.text;
}

/** Same as callRunpodAxonV1 but also surfaces token usage when RunPod reports one. */
export async function callRunpodAxonV1WithUsage(system: string, user: string): Promise<RunpodAxonV1Result> {
  const endpoint = resolveRunpodEndpoint();
  const key = resolveRunpodKey();

  if (!runpodEnabled()) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[ai-vault] RunPod AXON v1 tier skipped — paid GPU hosting, disabled by default until funded " +
          "(NI-Brain Decision #2001). Set AXON_ENABLE_RUNPOD=1 to opt in once funded. Falling through to Gemini.",
      );
    }
    return { text: null };
  }

  if (!endpoint || !key) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[ai-vault] RunPod AXON v1 tier skipped — RUNPOD_AXON_V1_ENDPOINT / RUNPOD_AXON_V1_KEY not configured " +
          "(AXON v1 is not deployed yet, see NI-Brain Decision #1261). Falling through to Gemini.",
      );
    }
    return { text: null };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          model: RUNPOD_AXON_V1_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
      }),
      signal: AbortSignal.timeout(RUNPOD_AXON_V1_TIMEOUT_MS),
    });

    if (!res.ok) return { text: null };

    const data = (await res.json()) as RunpodAxonV1Response;
    const text =
      data.output?.text?.trim() ||
      data.output?.choices?.[0]?.message?.content?.trim() ||
      data.output?.choices?.[0]?.text?.trim() ||
      data.choices?.[0]?.message?.content?.trim() ||
      data.choices?.[0]?.text?.trim() ||
      null;

    const rawUsage = data.output?.usage ?? data.usage;
    const usage = rawUsage
      ? { tokensIn: rawUsage.prompt_tokens, tokensOut: rawUsage.completion_tokens }
      : undefined;

    return { text: text || null, usage };
  } catch {
    return { text: null };
  }
}

/** Same shape as the other ai-vault providers so router.ts can use it interchangeably. */
export async function callRunpodAxonV1Provider(args: {
  system: string;
  user: string;
}): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const result = await callRunpodAxonV1WithUsage(args.system, args.user).catch(
    () => ({ text: null }) as RunpodAxonV1Result,
  );
  if (!result.text) {
    return {
      text: null,
      error: "RunPod AXON v1 unavailable, not configured, or returned no text.",
      model: RUNPOD_AXON_V1_MODEL,
    };
  }
  return { text: result.text, model: RUNPOD_AXON_V1_MODEL, usage: result.usage, ms: Date.now() - startedAt };
}
