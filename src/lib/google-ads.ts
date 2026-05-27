/** Google Ads account / global site tag ID. */
export const GOOGLE_ADS_ID = "AW-18191190585";

export type GoogleAdsConversionKind = "client_signup" | "trainer_signup";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function conversionLabelEnv(kind: GoogleAdsConversionKind): string | undefined {
  if (kind === "client_signup") {
    return process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SIGNUP_CONVERSION_LABEL?.trim();
  }
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_TRAINER_SIGNUP_CONVERSION_LABEL?.trim();
}

/** Builds `send_to` for gtag (`AW-…/label` or full value from env). */
export function googleAdsConversionSendTo(kind: GoogleAdsConversionKind): string | null {
  const raw = conversionLabelEnv(kind);
  if (!raw) return null;
  if (raw.includes("/")) return raw;
  return `${GOOGLE_ADS_ID}/${raw}`;
}

function dedupeStorageKey(kind: GoogleAdsConversionKind): string {
  return `match_fit_gads_conversion_${kind}`;
}

/**
 * Fires a Google Ads conversion event once per browser tab session.
 * No-op when the conversion label env var is unset (safe for local dev).
 */
export function trackGoogleAdsConversion(kind: GoogleAdsConversionKind): void {
  if (typeof window === "undefined") return;

  const sendTo = googleAdsConversionSendTo(kind);
  if (!sendTo) return;

  const storageKey = dedupeStorageKey(kind);
  try {
    if (sessionStorage.getItem(storageKey) === "1") return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // Private mode / blocked storage — still attempt the conversion.
  }

  window.gtag?.("event", "conversion", { send_to: sendTo });
}
