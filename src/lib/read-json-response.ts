/** Turn API/proxy error payloads into a readable string for UI alerts. */
export function formatUserFacingError(value: unknown, fallback = "Something went wrong."): string {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    const trimmed = value.message.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
    if (obj.error != null) {
      const nested = formatUserFacingError(obj.error, "");
      if (nested) return nested;
    }
    if (Array.isArray(obj.issues) && obj.issues.length > 0) {
      const first = obj.issues[0] as { message?: string };
      if (typeof first.message === "string" && first.message.trim()) return first.message.trim();
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}" && serialized !== "[]") return serialized;
    } catch {
      /* ignore circular refs */
    }
  }
  const asString = String(value);
  return asString === "[object Object]" ? fallback : asString.trim() || fallback;
}

/** Parse a fetch Response as JSON, with clear errors when the server returns HTML/plain text. */
export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}).`);
    }
    return {} as T;
  }

  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  const contentType = res.headers.get("content-type") ?? "";
  const isJsonContentType = contentType.includes("application/json");

  if (!looksLikeJson && !isJsonContentType) {
    const snippet = trimmed.slice(0, 160).replace(/\s+/g, " ").trim();
    if (res.status === 504 || /timed out|timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(trimmed)) {
      throw new Error(
        "Generation timed out on the server. Try smaller counts (e.g. 2 ATL + 3 virtual) and generate again.",
      );
    }
    if (/^An error occurred/i.test(trimmed)) {
      throw new Error(
        "The server hit an error while generating leads (often a timeout on long web-search runs). Try smaller counts or wait a minute and retry.",
      );
    }
    throw new Error(
      res.ok
        ? `Unexpected server response: ${snippet}`
        : `Request failed (${res.status}): ${snippet}`,
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      "Could not parse the server response as JSON. The request may have timed out — try smaller lead counts.",
    );
  }
}
