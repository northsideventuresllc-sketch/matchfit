import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGoogleMeetForWindow,
  createMicrosoftTeamsMeetingForWindow,
  createZoomMeetingForWindow,
} from "@/lib/trainer-video-oauth-tokens";

describe("createGoogleMeetForWindow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns Meet join URL and calendar event id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "evt_google_1",
        conferenceData: {
          entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }],
        },
      }),
    });

    const out = await createGoogleMeetForWindow({
      accessToken: "google-access",
      summary: "Match Fit session",
      start: new Date("2028-06-01T15:00:00.000Z"),
      end: new Date("2028-06-01T16:00:00.000Z"),
    });

    expect(out).toEqual({
      joinUrl: "https://meet.google.com/abc-defg-hij",
      eventId: "evt_google_1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("googleapis.com/calendar/v3/calendars/primary/events"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer google-access" }),
      }),
    );
  });

  it("surfaces Google API errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Insufficient Permission" } }),
    });

    const out = await createGoogleMeetForWindow({
      accessToken: "bad",
      summary: "S",
      start: new Date(),
      end: new Date(Date.now() + 3600000),
    });

    expect(out).toEqual({ error: "Insufficient Permission" });
  });
});

describe("createZoomMeetingForWindow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns Zoom join URL and meeting id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 99887766,
        join_url: "https://zoom.us/j/99887766?pwd=secret",
      }),
    });

    const out = await createZoomMeetingForWindow({
      accessToken: "zoom-access",
      topic: "Match Fit session",
      start: new Date("2028-06-01T15:00:00.000Z"),
      end: new Date("2028-06-01T16:00:00.000Z"),
    });

    expect(out).toEqual({
      joinUrl: "https://zoom.us/j/99887766?pwd=secret",
      meetingId: "99887766",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.zoom.us/v2/users/me/meetings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer zoom-access" }),
      }),
    );
  });
});

describe("createMicrosoftTeamsMeetingForWindow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns Teams join URL and meeting id via onlineMeetings API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "ms-meeting-1",
        joinWebUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc",
      }),
    });

    const out = await createMicrosoftTeamsMeetingForWindow({
      accessToken: "ms-access",
      subject: "Match Fit session",
      start: new Date("2028-06-01T15:00:00.000Z"),
      end: new Date("2028-06-01T16:00:00.000Z"),
    });

    expect(out).toEqual({
      joinUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc",
      meetingId: "ms-meeting-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/onlineMeetings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer ms-access" }),
      }),
    );
  });
});
