import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/read-json-response";

function response(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

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
