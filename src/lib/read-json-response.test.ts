import { describe, expect, it } from "vitest";
import { formatUserFacingError, readJsonResponse } from "@/lib/read-json-response";

function response(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

describe("formatUserFacingError", () => {
  it("returns strings as-is", () => {
    expect(formatUserFacingError("Provider unavailable")).toBe("Provider unavailable");
  });

  it("extracts nested message objects from proxy errors", () => {
    expect(formatUserFacingError({ message: "Function timed out." })).toBe("Function timed out.");
    expect(formatUserFacingError({ error: { message: "Anthropic rate limited." } })).toBe(
      "Anthropic rate limited.",
    );
  });

  it("avoids [object Object] for opaque objects", () => {
    expect(formatUserFacingError({ code: "UNKNOWN" }, "Generation failed.")).toBe('{"code":"UNKNOWN"}');
    expect(formatUserFacingError(new Error({ message: "hidden" } as unknown as string), "Fallback.")).toBe(
      "Fallback.",
    );
  });
});

describe("readJsonResponse", () => {
  it("parses valid JSON objects", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(response('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it("throws a friendly timeout message for plain-text Vercel errors", async () => {
    await expect(
      readJsonResponse(response("An error occurred with this serverless function", { status: 500 })),
    ).rejects.toThrow(/timed out|error while generating/i);
  });

  it("throws a helpful message when HTML/text is returned instead of JSON", async () => {
    await expect(readJsonResponse(response("An error occurred", { status: 504 }))).rejects.toThrow(
      /timed out|smaller counts/i,
    );
  });
});
