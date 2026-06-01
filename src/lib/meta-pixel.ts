/** Meta (Facebook) Pixel ID for Match Fit ads attribution. */
export const META_PIXEL_ID = "2866690703676850";

export type MetaConversionKind = "client_signup" | "trainer_signup";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

/** Standard Meta events aligned with Google Ads conversion goals. */
export function metaStandardEventForConversion(kind: MetaConversionKind): "Subscribe" | "CompleteRegistration" {
  return kind === "client_signup" ? "Subscribe" : "CompleteRegistration";
}

function dedupeStorageKey(kind: MetaConversionKind): string {
  return `match_fit_meta_conversion_${kind}`;
}

/**
 * Fires a Meta Pixel standard conversion event once per browser tab session.
 * Mirrors {@link trackGoogleAdsConversion} call sites for client and trainer signups.
 */
export function trackMetaConversion(kind: MetaConversionKind): void {
  if (typeof window === "undefined") return;

  const storageKey = dedupeStorageKey(kind);
  try {
    if (sessionStorage.getItem(storageKey) === "1") return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // Private mode / blocked storage — still attempt the event.
  }

  const event = metaStandardEventForConversion(kind);
  window.fbq?.("track", event, {
    content_name: kind,
  });
}

