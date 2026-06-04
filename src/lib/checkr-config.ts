/** Client-safe Checkr env helpers (no Prisma / Node-only imports). */

/** Secret API key from Checkr Dashboard → Developer Settings. */
export function getCheckrApiKey(): string | null {
  const key = process.env.CHECKR_API_KEY?.trim();
  return key || null;
}

export function isCheckrApiConfigured(): boolean {
  return getCheckrApiKey() != null;
}

/** Default mock Checkr charge when vendor is not wired (cents). */
export function defaultBackgroundCheckVendorPaidCents(): number {
  const raw = process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS?.trim();
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 4900;
}
