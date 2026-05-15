import { prisma } from "@/lib/prisma";
import { decryptUtf8, encryptUtf8 } from "@/lib/field-encryption";
import {
  ensureFreshAccessToken,
  parseOAuthTokenBundle,
  stringifyOAuthTokenBundle,
  type OAuthTokenBundle,
} from "@/lib/trainer-video-oauth-tokens";
import type { VideoConferenceProviderKey } from "@/lib/trainer-video-oauth-state";

const BATCH = 250;
/** Refresh access tokens this far before expiry so API calls rarely hit expired tokens. */
const REFRESH_WITHIN_MS = 6 * 60 * 60 * 1000;

function isVideoProvider(p: string): p is VideoConferenceProviderKey {
  return p === "GOOGLE" || p === "ZOOM" || p === "MICROSOFT";
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

/**
 * Proactively refreshes stored trainer video OAuth access tokens (Google Meet, Zoom, Microsoft Graph)
 * when the access token is missing, expired, or expiring soon. Intended for scheduled cron runs.
 */
export async function refreshTrainerVideoOAuthTokensNearExpiry(): Promise<{ refreshed: number; errors: number }> {
  const cutoff = new Date(Date.now() + REFRESH_WITHIN_MS);
  const rows = await prisma.trainerVideoConferenceConnection.findMany({
    where: {
      revokedAt: null,
      OR: [{ accessTokenExpiresAt: null }, { accessTokenExpiresAt: { lte: cutoff } }],
    },
    take: BATCH,
    select: { id: true, provider: true, encryptedOAuthBundle: true },
  });

  let refreshed = 0;
  let errors = 0;

  for (const row of rows) {
    if (!isVideoProvider(row.provider)) continue;
    const plain = decryptUtf8(row.encryptedOAuthBundle);
    if (!plain) {
      errors += 1;
      continue;
    }
    const bundle = parseOAuthTokenBundle(plain);
    if (!bundle) {
      errors += 1;
      continue;
    }
    try {
      const next = await ensureFreshAccessToken(row.provider, bundle);
      if ("error" in next) {
        errors += 1;
        continue;
      }
      if (
        next.accessToken === bundle.accessToken &&
        next.expiresAtMs === bundle.expiresAtMs &&
        next.refreshToken === bundle.refreshToken
      ) {
        continue;
      }
      await persistBundle(row.id, next);
      refreshed += 1;
    } catch {
      errors += 1;
    }
  }

  return { refreshed, errors };
}
