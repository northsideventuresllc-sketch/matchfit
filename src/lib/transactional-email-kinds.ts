/**
 * All branded transactional email types. Security-critical kinds ignore user email toggles.
 */
export const TRANSACTIONAL_EMAIL_KINDS = [
  "CLIENT_WELCOME",
  "TRAINER_WELCOME",
  "OTP_2FA",
  "PASSWORD_RESET",
  "EMAIL_CHANGE_CONFIRM",
  "EMAIL_CHANGE_SECURITY",
  "LOGIN_SECURITY_ALERT",
  "W9_TAX_VERIFICATION",
  "CERTIFICATION_RENEWAL_REMINDER",
  "BACKGROUND_CHECK_UPDATE",
  "ADMIN_REGISTRATION_REQUEST",
  "TRAINER_BACKGROUND_CHECK_REVIEW",
  "PURCHASE_CONFIRMATION",
  "COACH_PACKAGE_SALE",
  "TRAINER_PAYOUT",
  "SUBSCRIPTION_MANAGEMENT_UPDATE",
  "OFF_PLATFORM_VIOLATION_NOTICE",
  "BUG_REPORT_ACKNOWLEDGMENT",
  "NEW_CLIENT_INQUIRY",
  "CONTENT_MODERATION_NOTICE",
  "PAYMENT_FAILED",
  "POLICY_UPDATE",
  "BOOKING_SESSION_CONFIRMED",
] as const;

export type TransactionalEmailKind = (typeof TRANSACTIONAL_EMAIL_KINDS)[number];

/** Short human phrase for internal sample sends — never use raw kind enum strings in subjects. */
const TRANSACTIONAL_EMAIL_KIND_SAMPLE_LABELS: Record<TransactionalEmailKind, string> = {
  CLIENT_WELCOME: "Client welcome",
  TRAINER_WELCOME: "Trainer welcome",
  OTP_2FA: "Verification code",
  PASSWORD_RESET: "Password reset",
  EMAIL_CHANGE_CONFIRM: "Confirm new email",
  EMAIL_CHANGE_SECURITY: "Email change notice",
  LOGIN_SECURITY_ALERT: "New sign-in",
  W9_TAX_VERIFICATION: "W-9 copy",
  CERTIFICATION_RENEWAL_REMINDER: "Certification renewal",
  BACKGROUND_CHECK_UPDATE: "Background check",
  ADMIN_REGISTRATION_REQUEST: "Administrator request",
  TRAINER_BACKGROUND_CHECK_REVIEW: "Trainer background check review",
  PURCHASE_CONFIRMATION: "Purchase confirmation",
  COACH_PACKAGE_SALE: "New package sale",
  TRAINER_PAYOUT: "Trainer payout",
  SUBSCRIPTION_MANAGEMENT_UPDATE: "Subscription update",
  OFF_PLATFORM_VIOLATION_NOTICE: "Policy notice",
  BUG_REPORT_ACKNOWLEDGMENT: "Bug report",
  NEW_CLIENT_INQUIRY: "New client inquiry",
  CONTENT_MODERATION_NOTICE: "Content review",
  PAYMENT_FAILED: "Payment issue",
  POLICY_UPDATE: "Policy update",
  BOOKING_SESSION_CONFIRMED: "Session booking confirmed",
};

export function transactionalEmailKindSampleLabel(kind: TransactionalEmailKind): string {
  return TRANSACTIONAL_EMAIL_KIND_SAMPLE_LABELS[kind];
}

/** Kinds that are always sent when triggered, regardless of dashboard email toggles. */
export const MANDATORY_TRANSACTIONAL_EMAIL_KINDS: ReadonlySet<TransactionalEmailKind> = new Set([
  "OTP_2FA",
  "PASSWORD_RESET",
  "EMAIL_CHANGE_CONFIRM",
  "EMAIL_CHANGE_SECURITY",
  "LOGIN_SECURITY_ALERT",
  "ADMIN_REGISTRATION_REQUEST",
  "TRAINER_BACKGROUND_CHECK_REVIEW",
]);

export function isMandatoryTransactionalEmailKind(kind: TransactionalEmailKind): boolean {
  return MANDATORY_TRANSACTIONAL_EMAIL_KINDS.has(kind);
}
