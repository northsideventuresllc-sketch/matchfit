import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  signTrainerMicrosoftSupabaseLinkState,
  verifyTrainerMicrosoftSupabaseLinkState,
} from "@/lib/trainer-video-oauth-state";
import {
  MICROSOFT_GRAPH_OAUTH_SCOPES,
  microsoftAccessTokenExpiresAtMs,
} from "@/lib/trainer-video-oauth-tokens";

describe("Microsoft Graph OAuth helpers", () => {
  it("requests the required delegated scopes (space-separated)", () => {
    expect(MICROSOFT_GRAPH_OAUTH_SCOPES).toContain("openid");
    expect(MICROSOFT_GRAPH_OAUTH_SCOPES).toContain("offline_access");
    expect(MICROSOFT_GRAPH_OAUTH_SCOPES).toContain("Calendars.ReadWrite");
    expect(MICROSOFT_GRAPH_OAUTH_SCOPES).toContain("OnlineMeetings.ReadWrite");
    expect(MICROSOFT_GRAPH_OAUTH_SCOPES).not.toContain(",");
  });

  it("parses exp from a Microsoft-style JWT access token", () => {
    const expSec = 2_000_000_000;
    const payload = Buffer.from(JSON.stringify({ exp: expSec, aud: "graph" })).toString("base64url");
    const token = `eyJhbGciOiJub25lIn0.${payload}.sig`;
    const ms = microsoftAccessTokenExpiresAtMs(token);
    expect(ms).toBe(expSec * 1000);
  });

  it("returns undefined for non-JWT access tokens", () => {
    expect(microsoftAccessTokenExpiresAtMs(undefined)).toBeUndefined();
    expect(microsoftAccessTokenExpiresAtMs("not-a-jwt")).toBeUndefined();
  });
});

describe("trainer Microsoft ↔ Supabase link state JWT", () => {
  it("round-trips trainer id", async () => {
    const token = await signTrainerMicrosoftSupabaseLinkState("trainer_test_123");
    const parsed = await verifyTrainerMicrosoftSupabaseLinkState(token);
    expect(parsed?.trainerId).toBe("trainer_test_123");
  });

  it("rejects wrong JWT type", async () => {
    const { SignJWT } = await import("jose");
    const { getAuthSecretKey } = await import("@/lib/session");
    const wrong = await new SignJWT({ t: "other", x: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(getAuthSecretKey());
    expect(await verifyTrainerMicrosoftSupabaseLinkState(wrong)).toBeNull();
  });
});

const mockPost = vi.fn();

vi.mock("@microsoft/microsoft-graph-client", () => ({
  Client: {
    init: vi.fn(() => ({
      api: () => ({
        post: (body: unknown) => mockPost(body),
      }),
    })),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerVideoConferenceConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("createMicrosoftMeeting", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Teams calendar event and returns join URL + event id", async () => {
    const { prisma } = await import("@/lib/prisma");
    const fe = await import("@/lib/field-encryption");
    const tokens = await import("@/lib/trainer-video-oauth-tokens");

    vi.mocked(prisma.trainerVideoConferenceConnection.findFirst).mockResolvedValue({
      id: "conn-1",
      encryptedOAuthBundle: "encrypted-blob",
    } as never);
    vi.mocked(prisma.trainerVideoConferenceConnection.update).mockResolvedValue({} as never);

    vi.spyOn(fe, "decryptUtf8").mockReturnValue(
      JSON.stringify({
        refreshToken: "r1",
        accessToken: "a1",
        expiresAtMs: Date.now() + 3_600_000,
      }),
    );
    vi.spyOn(tokens, "ensureFreshAccessToken").mockImplementation(async (_p, b) => b);

    mockPost.mockResolvedValue({
      id: "event-graph-id-99",
      webLink: "https://outlook.office365.com/owa/?itemid=abc",
      onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/xxxxx" },
    });

    const { createMicrosoftMeeting } = await import("@/lib/microsoft-graph-meeting");
    const out = await createMicrosoftMeeting("trainer-1", {
      subject: "Unit test session",
      start: new Date("2028-06-01T15:00:00.000Z"),
      end: new Date("2028-06-01T16:00:00.000Z"),
      timeZone: "UTC",
    });

    expect(out).toEqual({
      ok: true,
      joinUrl: "https://teams.microsoft.com/l/meetup-join/xxxxx",
      eventId: "event-graph-id-99",
      webLink: "https://outlook.office365.com/owa/?itemid=abc",
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const body = mockPost.mock.calls[0][0] as Record<string, unknown>;
    expect(body.subject).toBe("Unit test session");
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe("teamsForBusiness");
    expect(body.start).toEqual({ dateTime: "2028-06-01T15:00:00", timeZone: "UTC" });
    expect(body.end).toEqual({ dateTime: "2028-06-01T16:00:00", timeZone: "UTC" });

    expect(prisma.trainerVideoConferenceConnection.update).toHaveBeenCalled();
  });

  it("returns error when trainer has no Microsoft connection", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.trainerVideoConferenceConnection.findFirst).mockResolvedValue(null);

    const { createMicrosoftMeeting } = await import("@/lib/microsoft-graph-meeting");
    const out = await createMicrosoftMeeting("trainer-x", {
      subject: "S",
      start: new Date(),
      end: new Date(),
    });
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toMatch(/Connect Microsoft/i);
    }
  });
});
