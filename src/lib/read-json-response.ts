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
