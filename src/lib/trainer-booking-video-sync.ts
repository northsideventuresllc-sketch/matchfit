import { prisma } from "@/lib/prisma";
import { decryptUtf8, encryptUtf8 } from "@/lib/field-encryption";
import { clientHasPaidTrainerOnce } from "@/lib/trainer-client-booking-credits";
import {
  createGoogleMeetForWindow,
  createMicrosoftTeamsMeetingForWindow,
  createZoomMeetingForWindow,
  ensureFreshAccessToken,
  parseOAuthTokenBundle,
  stringifyOAuthTokenBundle,
  type OAuthTokenBundle,
} from "@/lib/trainer-video-oauth-tokens";
import type { VideoConferenceProviderKey } from "@/lib/trainer-video-oauth-state";

function isHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function bookingVideoProviderLabel(p: VideoConferenceProviderKey): "GOOGLE_MEET" | "ZOOM" | "MICROSOFT_TEAMS" {
  if (p === "GOOGLE") return "GOOGLE_MEET";
  if (p === "ZOOM") return "ZOOM";
  return "MICROSOFT_TEAMS";
}

async function persistBundle(connectionId: string, next: OAuthTokenBundle): Promise<void> {
  await prisma.trainerVideoConferenceConnection.update({
    where: { id: connectionId },
    data: {
      encryptedOAuthBundle: encryptUtf8(stringifyOAuthTokenBundle(next)),
      accessTokenExpiresAt: next.expiresAtMs ? new Date(next.expiresAtMs) : null,
      updatedAt: new Date(),
    },
  });
}

export async function trainerSetManualBookingVideo(args: {
  trainerId: string;
  bookingId: string;
  joinUrl: string;
}): Promise<{ ok: true } | { error: string }> {
  const url = args.joinUrl.trim();
  if (!isHttpsUrl(url)) {
    return { error: "Join link must be a valid https:// URL." };
  }
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, trainerId: args.trainerId },
    select: { id: true, clientId: true, status: true },
  });
  if (!row || row.status === "CANCELLED") {
    return { error: "Booking not found or cancelled." };
  }
  const paid = await clientHasPaidTrainerOnce(row.clientId, args.trainerId);
  if (!paid) {
    return { error: "Virtual meetings are available only after this client has completed a paid checkout with you." };
  }
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      videoConferenceJoinUrl: url,
      videoConferenceProvider: "MANUAL",
      videoConferenceExternalId: null,
      videoConferenceSyncedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function trainerSyncBookingVideoFromOAuth(args: {
  trainerId: string;
  bookingId: string;
  provider: VideoConferenceProviderKey;
}): Promise<{ ok: true; joinUrl: string } | { error: string }> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, trainerId: args.trainerId },
    select: {
      id: true,
      clientId: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });
  if (!row || row.status === "CANCELLED") {
    return { error: "Booking not found or cancelled." };
  }
  const paid = await clientHasPaidTrainerOnce(row.clientId, args.trainerId);
  if (!paid) {
    return { error: "Virtual meetings are available only after this client has completed a paid checkout with you." };
  }
  const end = row.scheduledEndAt ?? new Date(row.scheduledStartAt.getTime() + 60 * 60 * 1000);

  const conn = await prisma.trainerVideoConferenceConnection.findFirst({
    where: { trainerId: args.trainerId, provider: args.provider, revokedAt: null },
  });
  if (!conn) {
    return { error: "Connect this provider under Virtual Meetings in your dashboard first." };
  }
  const plain = decryptUtf8(conn.encryptedOAuthBundle);
  if (!plain) return { error: "Stored credentials could not be decrypted. Disconnect and reconnect this provider." };
  let bundle = parseOAuthTokenBundle(plain);
  if (!bundle) return { error: "Stored credentials are invalid. Disconnect and reconnect this provider." };

  const fresh = await ensureFreshAccessToken(args.provider, bundle);
  if ("error" in fresh) return { error: fresh.error };
  bundle = fresh;
  await persistBundle(conn.id, bundle);

  const access = bundle.accessToken;
  if (!access) return { error: "No valid access token. Reconnect this provider." };

  const subject = "Match Fit training session";
  if (args.provider === "GOOGLE") {
    const created = await createGoogleMeetForWindow({
      accessToken: access,
      summary: subject,
      start: row.scheduledStartAt,
      end,
    });
    if ("error" in created) return { error: created.error };
    await prisma.bookedTrainingSession.update({
      where: { id: row.id },
      data: {
        videoConferenceJoinUrl: created.joinUrl,
        videoConferenceProvider: bookingVideoProviderLabel("GOOGLE"),
        videoConferenceExternalId: created.eventId,
        videoConferenceSyncedAt: new Date(),
      },
    });
    return { ok: true, joinUrl: created.joinUrl };
  }
  if (args.provider === "ZOOM") {
    const created = await createZoomMeetingForWindow({
      accessToken: access,
      topic: subject,
      start: row.scheduledStartAt,
      end,
    });
    if ("error" in created) return { error: created.error };
    await prisma.bookedTrainingSession.update({
      where: { id: row.id },
      data: {
        videoConferenceJoinUrl: created.joinUrl,
        videoConferenceProvider: bookingVideoProviderLabel("ZOOM"),
        videoConferenceExternalId: created.meetingId,
        videoConferenceSyncedAt: new Date(),
      },
    });
    return { ok: true, joinUrl: created.joinUrl };
  }
  const created = await createMicrosoftTeamsMeetingForWindow({
    accessToken: access,
    subject,
    start: row.scheduledStartAt,
    end,
  });
  if ("error" in created) return { error: created.error };
  await prisma.bookedTrainingSession.update({
    where: { id: row.id },
    data: {
      videoConferenceJoinUrl: created.joinUrl,
      videoConferenceProvider: bookingVideoProviderLabel("MICROSOFT"),
      videoConferenceExternalId: created.meetingId,
      videoConferenceSyncedAt: new Date(),
    },
  });
  return { ok: true, joinUrl: created.joinUrl };
}
