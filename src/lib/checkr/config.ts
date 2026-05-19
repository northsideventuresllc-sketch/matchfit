/** Checkr API configuration — set keys when your Checkr account is ready. */
export function getCheckrApiKey(): string | null {
  const key = process.env.CHECKR_API_KEY?.trim();
  return key || null;
}

export function getCheckrWebhookSecret(): string | null {
  const secret = process.env.CHECKR_WEBHOOK_SECRET?.trim();
  return secret || null;
}

/** Checkr package slug (Dashboard → Packages). Example: `tasker_standard`. */
export function getCheckrPackageSlug(): string {
  return process.env.CHECKR_PACKAGE_SLUG?.trim() || "tasker_standard";
}

export function isCheckrConfigured(): boolean {
  return Boolean(getCheckrApiKey());
}

/** Operator inbox for flagged background checks (defaults to jb@match-fit.net). */
export function getBackgroundCheckReviewInbox(): string {
  return process.env.MATCH_FIT_BACKGROUND_CHECK_REVIEW_INBOX?.trim() || "jb@match-fit.net";
}

export const CHECKR_API_BASE = "https://api.checkr.com/v1";
