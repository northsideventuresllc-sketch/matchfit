import "server-only";

import type { ProviderCallResult } from "@/lib/ai-vault/providers";

/**
 * AXON-EVERYWHERE-PROJECT / JB direct order 2026-08-20: tier 2 in the canonical AI
 * Vault chain — AXON v1, NVG's own fine-tuned model (base: Qwen3-Coder-30B-A3B-Instruct,
 * per NI-Brain Decision #1261), hosted on RunPod (RTX A6000 48GB, Community Cloud).
 *
 * NOT DEPLOYED YET as of 2026-08-20 — Decision #1261 is model+pod choice only, pilot
 * test run not yet executed. This provider is wired into the chain now so router.ts
 * only needs `RUNPOD_AXON_V1_ENDPOINT` / `RUNPOD_AXON_V1_KEY` added to the AI Vault
 * (`platform_secrets` / `ni_platform_secrets`) once the pod is live — no code change.
 *
 * Same contract shape as `callAxonLocalProvider`: returns `null` on ANY failure, timeout,
 * or missing config — never throws — so callMatchFitAi() falls through to Gemini primary
 * exactly as if this tier didn't exist. Missing config is logged once per process, not on
 * every call, and never triggers a network request.
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

type RunpodAxonV1Response = {
  output?: {
    text?: string;
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  choices?: Array<{ message?: { content?: string }; text?: string }>;
};

/**
 * Try NVG's own RunPod-hosted AXON v1 model.
 * Returns null on any missing config / failure / timeout — never throws.
 */
export async function callRunpodAxonV1(system: string, user: string): Promise<string | null> {
  const endpoint = resolveRunpodEndpoint();
  const key = resolveRunpodKey();

  if (!endpoint || !key) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[ai-vault] RunPod AXON v1 tier skipped — RUNPOD_AXON_V1_ENDPOINT / RUNPOD_AXON_V1_KEY not configured " +
          "(AXON v1 is not deployed yet, see NI-Brain Decision #1261). Falling through to Gemini.",
      );
    }
    return null;
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

    if (!res.ok) return null;

    const data = (await res.json()) as RunpodAxonV1Response;
    const text =
      data.output?.text?.trim() ||
      data.output?.choices?.[0]?.message?.content?.trim() ||
      data.output?.choices?.[0]?.text?.trim() ||
      data.choices?.[0]?.message?.content?.trim() ||
      data.choices?.[0]?.text?.trim() ||
      null;

    return text || null;
  } catch {
    return null;
  }
}

/** Same shape as the other ai-vault providers so router.ts can use it interchangeably. */
export async function callRunpodAxonV1Provider(args: {
  system: string;
  user: string;
}): Promise<ProviderCallResult> {
  const text = await callRunpodAxonV1(args.system, args.user).catch(() => null);
  if (!text) {
    return {
      text: null,
      error: "RunPod AXON v1 unavailable, not configured, or returned no text.",
      model: RUNPOD_AXON_V1_MODEL,
    };
  }
  return { text, model: RUNPOD_AXON_V1_MODEL };
}
