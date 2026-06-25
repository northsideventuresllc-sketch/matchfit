import "server-only";

import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export type GeminiCallResult = {
  text: string | null;
  error?: string;
};

export function isValidGeminiApiKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
}

export function resolveGeminiApiKey(): string | null {
  for (const envKey of ["GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY", "GOOGLE_API_KEY"] as const) {
    const value = process.env[envKey]?.trim();
    if (isValidGeminiApiKey(value)) return value!;
  }
  return null;
}

export function resolveGeminiModel(): string {
  return (
    process.env.GEMINI_CONTENT_CALENDAR_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

export function isGeminiFallbackConfigured(): boolean {
  return Boolean(resolveGeminiApiKey());
}

function summarizeGeminiError(status: number, body: string): string {
  let detail = body.slice(0, 240).replace(/\s+/g, " ").trim();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    detail = parsed.error?.message ?? parsed.message ?? detail;
  } catch {
    // keep raw detail
  }
  return `Gemini HTTP ${status}${detail ? `: ${detail}` : ""}`;
}

export async function callGeminiGenerateContent(args: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}): Promise<GeminiCallResult> {
  await hydratePlatformEnvFromDatabase();
  const key = resolveGeminiApiKey();
  if (!key) {
    return { text: null, error: "GEMINI_API_KEY is not configured for fallback." };
  }

  const model = resolveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          temperature: args.temperature ?? 0.55,
          maxOutputTokens: args.maxTokens ?? 2000,
          ...(args.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(args.timeoutMs ?? 45_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { text: null, error: summarizeGeminiError(res.status, errBody) };
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text?.trim())
        .filter(Boolean)
        .join("\n\n") ?? null;

    if (!text) {
      return { text: null, error: "Gemini returned an empty response." };
    }

    return { text };
  } catch (error) {
    const message =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "Gemini request timed out."
        : `Gemini request failed: ${error instanceof Error ? error.message : "unknown error"}`;
    return { text: null, error: message };
  }
}
