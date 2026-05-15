import { Client } from "@microsoft/microsoft-graph-client";
import { decryptUtf8, encryptUtf8 } from "@/lib/field-encryption";
import { prisma } from "@/lib/prisma";
import {
  ensureFreshAccessToken,
  parseOAuthTokenBundle,
  stringifyOAuthTokenBundle,
  type OAuthTokenBundle,
} from "@/lib/trainer-video-oauth-tokens";

export type MicrosoftMeetingDetails = {
  subject: string;
  start: Date;
  end: Date;
  body?: string;
  /** IANA time zone for calendar start/end (defaults to UTC). */
  timeZone?: string;
};

function graphLocalDateTime(isoUtc: Date, timeZone: string): { dateTime: string; timeZone: string } {
  if (timeZone === "UTC") {
    return { dateTime: isoUtc.toISOString().slice(0, 19), timeZone: "UTC" };
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(isoUtc);
    const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
    const y = pick("year");
    const mo = pick("month");
    const d = pick("day");
    const h = pick("hour");
    const mi = pick("minute");
    const s = pick("second");
    if (!y || !mo || !d) {
      return { dateTime: isoUtc.toISOString().slice(0, 19), timeZone: "UTC" };
    }
    return { dateTime: `${y}-${mo}-${d}T${h}:${mi}:${s}`, timeZone };
  } catch {
    return { dateTime: isoUtc.toISOString().slice(0, 19), timeZone: "UTC" };
  }
}

async function persistMicrosoftBundle(connectionId: string, next: OAuthTokenBundle): Promise<void> {
  await prisma.trainerVideoConferenceConnection.update({
    where: { id: connectionId },
    data: {
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(next)),
      accessTokenExpiresAt: next.expiresAtMs ? new Date(next.expiresAtMs) : null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Creates a Teams-backed calendar event on the trainer’s primary Outlook calendar and returns the Teams join URL.
 * Requires a stored Microsoft Graph OAuth bundle on {@link prisma.trainerVideoConferenceConnection} (`MICROSOFT`).
 */
export async function createMicrosoftMeeting(
  trainerId: string,
  meetingDetails: MicrosoftMeetingDetails,
): Promise<{ ok: true; joinUrl: string; eventId: string; webLink: string | null } | { error: string }> {
  const conn = await prisma.trainerVideoConferenceConnection.findFirst({
    where: { trainerId, provider: "MICROSOFT", revokedAt: null },
  });
  if (!conn) {
    return { error: "Connect Microsoft (Outlook / Teams) under Virtual Meetings in your dashboard first." };
  }

  const plain = decryptUtf8(conn.encryptedOAuthBundle);
  if (!plain) return { error: "Stored credentials could not be decrypted. Disconnect and reconnect Microsoft." };
  let bundle = parseOAuthTokenBundle(plain);
  if (!bundle) return { error: "Stored credentials are invalid. Disconnect and reconnect Microsoft." };

  const fresh = await ensureFreshAccessToken("MICROSOFT", bundle);
  if ("error" in fresh) return { error: fresh.error };
  bundle = fresh;
  await persistMicrosoftBundle(conn.id, bundle);

  const access = bundle.accessToken;
  if (!access) return { error: "No valid Microsoft access token. Reconnect Microsoft." };

  const timeZone = meetingDetails.timeZone?.trim() || "UTC";
  const start = graphLocalDateTime(meetingDetails.start, timeZone);
  const end = graphLocalDateTime(meetingDetails.end, timeZone);

  const client = Client.init({
    authProvider: (done) => {
      done(null, access);
    },
  });

  const eventBody = {
    subject: meetingDetails.subject,
    body: meetingDetails.body
      ? {
          contentType: "HTML",
          content: meetingDetails.body,
        }
      : undefined,
    start,
    end,
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };

  try {
    const created = (await client.api("/me/events").post(eventBody)) as Record<string, unknown>;
    const id = typeof created.id === "string" ? created.id : "";
    const webLink = typeof created.webLink === "string" ? created.webLink : null;
    const om = created.onlineMeeting as Record<string, unknown> | undefined;
    const joinUrl =
      (om && typeof om.joinUrl === "string" && om.joinUrl) ||
      (om && typeof om.joinWebUrl === "string" && om.joinWebUrl) ||
      "";
    if (!id) return { error: "Microsoft Graph did not return a calendar event id." };
    if (!joinUrl.startsWith("https://")) return { error: "Microsoft Graph did not return a Teams join URL." };
    return { ok: true, joinUrl, eventId: id, webLink };
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "body" in e && typeof (e as { body?: { message?: string } }).body?.message === "string"
        ? (e as { body: { message: string } }).body.message
        : "microsoft_graph_event_failed";
    return { error: msg };
  }
}
