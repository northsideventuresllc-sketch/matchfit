import { AI_VAULT_ANTHROPIC_MAX_ATTEMPTS, AI_VAULT_DEFAULT_TIMEOUT_MS } from "@/lib/ai-vault/constants";
import { resolveAnthropicApiKey } from "@/lib/ai-vault/keys";
import { resolveGeminiModel } from "@/lib/ai-vault/models";
import type { AiVaultProviderId } from "@/lib/ai-vault/types";

function summarizeHttpError(status: number, body: string, provider: string): string {
  let detail = body.slice(0, 240).replace(/\s+/g, " ").trim();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    detail = parsed.error?.message ?? parsed.message ?? detail;
  } catch {
    // keep raw detail
  }
  return `${provider} HTTP ${status}${detail ? `: ${detail}` : ""}`;
}

function requestFailureMessage(error: unknown, provider: string): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `${provider} request timed out.`;
  }
  return `${provider} request failed: ${error instanceof Error ? error.message : "unknown error"}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProviderCallResult = {
  text: string | null;
  error?: string;
};

export async function callAnthropicProvider(args: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  tools?: unknown[];
  priorTurns?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ProviderCallResult> {
  const key = resolveAnthropicApiKey();
  if (!key) {
    return { text: null, error: "ANTHROPIC_API_KEY is not configured." };
  }

  for (let attempt = 1; attempt <= AI_VAULT_ANTHROPIC_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.maxTokens,
          system: args.system,
          messages: [...(args.priorTurns ?? []), { role: "user", content: args.user }],
          temperature: args.temperature,
          ...(args.tools?.length ? { tools: args.tools } : {}),
        }),
        signal: AbortSignal.timeout(args.timeoutMs),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        const message = summarizeHttpError(res.status, errBody, "Anthropic");
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < AI_VAULT_ANTHROPIC_MAX_ATTEMPTS) {
          await sleep(700 * attempt);
          continue;
        }
        return { text: null, error: message };
      }

      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text =
        data.content
          ?.filter((block) => block.type === "text" && block.text?.trim())
          .map((block) => block.text!.trim())
          .join("\n\n") ?? null;

      if (!text) {
        return { text: null, error: "Anthropic returned an empty response." };
      }

      return { text };
    } catch (error) {
      const message = requestFailureMessage(error, "Anthropic");
      if (attempt < AI_VAULT_ANTHROPIC_MAX_ATTEMPTS) {
        await sleep(700 * attempt);
        continue;
      }
      return { text: null, error: message };
    }
  }

  return { text: null, error: "Anthropic request failed after retries." };
}

export async function callGeminiProvider(args: {
  system: string;
  user: string;
  apiKey: string;
  providerId: Extract<AiVaultProviderId, "gemini-primary" | "gemini-backup">;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
  timeoutMs: number;
}): Promise<ProviderCallResult> {
  const model = resolveGeminiModel();
  const providerLabel = args.providerId === "gemini-primary" ? "Gemini primary" : "Gemini backup";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          temperature: args.temperature,
          maxOutputTokens: args.maxTokens,
          ...(args.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(args.timeoutMs),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { text: null, error: summarizeHttpError(res.status, errBody, providerLabel) };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text?.trim())
        .filter(Boolean)
        .join("\n\n") ?? null;

    if (!text) {
      return { text: null, error: `${providerLabel} returned an empty response.` };
    }

    return { text };
  } catch (error) {
    return { text: null, error: requestFailureMessage(error, providerLabel) };
  }
}

export const DEFAULT_PROVIDER_TIMEOUT_MS = AI_VAULT_DEFAULT_TIMEOUT_MS;
