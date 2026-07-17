import "server-only";

import { createHmac } from "crypto";

/** Match Fit Meta app id (developers.facebook.com → Match Fit). */
export const MATCH_FIT_META_APP_ID = "1326626849446738";

/**
 * HMAC-SHA256(access_token, app_secret) for Graph `appsecret_proof`.
 * Required when App Dashboard → Settings → Advanced → "Require App Secret" is ON.
 */
export function metaAppSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret.trim()).update(accessToken.trim()).digest("hex");
}

/** Optional proof from `META_APP_SECRET` when configured. */
export function maybeMetaAppSecretProof(accessToken: string): string | null {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return null;
  return metaAppSecretProof(accessToken, secret);
}

/**
 * Append access_token (+ appsecret_proof when META_APP_SECRET is set) to a Graph URL.
 */
export function withMetaGraphAuth(url: URL, accessToken: string): URL {
  url.searchParams.set("access_token", accessToken.trim());
  const proof = maybeMetaAppSecretProof(accessToken);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  return url;
}
