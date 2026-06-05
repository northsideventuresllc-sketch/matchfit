import "server-only";

import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; expiresAt: number }>();

/** True when Vercel still has the placeholder test secret instead of a live key. */
export function isPlaceholderStripeSecretKey(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (value.endsWith("_key") && value.startsWith("sk_test_")) return true;
  if (process.env.VERCEL_ENV === "production" && value.startsWith("sk_test_")) return true;
  return false;
}

export function isPlaceholderStripePublishableKey(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (process.env.VERCEL_ENV === "production" && value.startsWith("pk_test_")) return true;
  return false;
}

export function isPlaceholderStripeWebhookSecret(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (value === "whsec_test" || value.startsWith("whsec_test_")) {
    return process.env.VERCEL_ENV === "production";
  }
  return false;
}

async function readPlatformSecret(key: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const row = await prisma.platformSecret.findUnique({ where: { key } });
    const value = row?.value?.trim() ?? null;
    if (value) {
      cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    }
    return value;
  } catch {
    return null;
  }
}

/** Env first; falls back to `platform_secrets` when env is missing or a known placeholder. */
export async function resolvePlatformSecret(
  key: string,
  envValue: string | null | undefined,
  isPlaceholder: (value: string | null | undefined) => boolean,
): Promise<string | null> {
  const trimmed = envValue?.trim();
  if (trimmed && !isPlaceholder(trimmed)) return trimmed;
  return readPlatformSecret(key);
}

/** Synchronous env-only read (legacy). */
export function resolvePlatformSecretFromEnv(
  envValue: string | null | undefined,
  isPlaceholder: (value: string | null | undefined) => boolean,
): string | null {
  const trimmed = envValue?.trim();
  if (trimmed && !isPlaceholder(trimmed)) return trimmed;
  return null;
}

export function clearPlatformSecretCache(): void {
  cache.clear();
}
