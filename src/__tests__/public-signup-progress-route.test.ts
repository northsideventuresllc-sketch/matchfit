import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpsertSignupFormProgress } = vi.hoisted(() => ({
  mockUpsertSignupFormProgress: vi.fn(),
}));

vi.mock("@/lib/signup-form-progress", () => ({
  upsertSignupFormProgress: mockUpsertSignupFormProgress,
}));

import { POST } from "@/app/api/public/signup-progress/route";

describe("POST /api/public/signup-progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertSignupFormProgress.mockResolvedValue(undefined);
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const response = await POST(
      new Request("https://matchfit.test/api/public/signup-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON." });
    expect(mockUpsertSignupFormProgress).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(
      new Request("https://matchfit.test/api/public/signup-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "client", visitorId: "visitor_1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "role, visitorId, and fields are required.",
    });
    expect(mockUpsertSignupFormProgress).not.toHaveBeenCalled();
  });

  it("returns 400 when role is invalid", async () => {
    const response = await POST(
      new Request("https://matchfit.test/api/public/signup-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "staff",
          visitorId: "visitor_1",
          fields: { firstName: true },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "role, visitorId, and fields are required.",
    });
  });

  it("upserts signup progress for valid payloads", async () => {
    const response = await POST(
      new Request("https://matchfit.test/api/public/signup-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "trainer",
          visitorId: "  visitor_abc  ",
          fields: { firstName: true, email: true },
          email: "coach@example.com",
          username: "coach-abc",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockUpsertSignupFormProgress).toHaveBeenCalledWith({
      role: "trainer",
      visitorId: "visitor_abc",
      fields: { firstName: true, email: true },
      email: "coach@example.com",
      username: "coach-abc",
    });
  });
});
