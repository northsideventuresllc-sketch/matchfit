/** Public site key (embedded in client bundles at build time). */
export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

/** Server-only secret for Cloudflare siteverify. */
export function getTurnstileSecretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
}

export function isTurnstileClientEnabled(): boolean {
  return getTurnstileSiteKey().length > 0;
}

export function isTurnstileServerVerificationEnabled(): boolean {
  return getTurnstileSecretKey().length > 0;
}

/** Both keys set — widget should render and API must verify tokens. */
export function isTurnstileFullyConfigured(): boolean {
  return isTurnstileClientEnabled() && isTurnstileServerVerificationEnabled();
}

export function isTurnstileStrictMode(): boolean {
  const v = process.env.MATCH_FIT_TURNSTILE_STRICT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Client-safe constant for forms (inlined at build). */
export const TURNSTILE_SITE_KEY_PUBLIC = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
