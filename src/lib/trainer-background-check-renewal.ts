const MS_PER_DAY = 86400000;
const VALIDITY_DAYS = 365;
const WARNING_LEAD_DAYS = 30;

export function backgroundCheckExpiresAt(clearedAt: Date): Date {
  return new Date(clearedAt.getTime() + VALIDITY_DAYS * MS_PER_DAY);
}

export function backgroundCheckWarningStartsAt(clearedAt: Date): Date {
  return new Date(backgroundCheckExpiresAt(clearedAt).getTime() - WARNING_LEAD_DAYS * MS_PER_DAY);
}

/** APPROVED screening is invalid after 12 months from `clearedAt` (Terms §11–12). */
export function isBackgroundCheckExpired(clearedAt: Date | null | undefined): boolean {
  if (!clearedAt) return false;
  return Date.now() >= backgroundCheckExpiresAt(clearedAt).getTime();
}

export function shouldSendBackgroundCheckExpiryWarning(
  clearedAt: Date | null | undefined,
  warningSentAt: Date | null | undefined,
): boolean {
  if (!clearedAt || isBackgroundCheckExpired(clearedAt)) return false;
  if (warningSentAt) return false;
  return Date.now() >= backgroundCheckWarningStartsAt(clearedAt).getTime();
}
