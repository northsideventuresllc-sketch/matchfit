import type { ClientNotificationPrefs } from "@/lib/client-notification-prefs";
import type { TrainerNotificationPrefs } from "@/lib/trainer-notification-prefs";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { isMandatoryTransactionalEmailKind } from "@/lib/transactional-email-kinds";

/** Whether a client account should receive this optional transactional email. */
export function clientAllowsTransactionalEmailKind(
  prefs: ClientNotificationPrefs,
  kind: TransactionalEmailKind,
): boolean {
  if (isMandatoryTransactionalEmailKind(kind)) return true;
  switch (kind) {
    case "CLIENT_WELCOME":
      return prefs.emailWelcome;
    case "PURCHASE_CONFIRMATION":
    case "PAYMENT_FAILED":
      return prefs.emailPurchases;
    case "SUBSCRIPTION_MANAGEMENT_UPDATE":
    case "POLICY_UPDATE":
      return prefs.emailBilling;
    case "BACKGROUND_CHECK_UPDATE":
      return prefs.emailCompliance;
    case "OFF_PLATFORM_VIOLATION_NOTICE":
    case "CONTENT_MODERATION_NOTICE":
      return prefs.emailTrustSafety;
    case "BUG_REPORT_ACKNOWLEDGMENT":
      return prefs.emailProduct;
    default:
      return true;
  }
}

/** Whether a trainer account should receive this optional transactional email. */
export function trainerAllowsTransactionalEmailKind(
  prefs: TrainerNotificationPrefs,
  kind: TransactionalEmailKind,
): boolean {
  if (isMandatoryTransactionalEmailKind(kind)) return true;
  switch (kind) {
    case "TRAINER_WELCOME":
      return prefs.emailWelcome;
    case "COACH_PACKAGE_SALE":
      return prefs.emailPurchases;
    case "TRAINER_PAYOUT":
      return prefs.emailPayouts;
    case "SUBSCRIPTION_MANAGEMENT_UPDATE":
    case "PAYMENT_FAILED":
    case "POLICY_UPDATE":
      return prefs.emailBilling;
    case "W9_TAX_VERIFICATION":
    case "CERTIFICATION_RENEWAL_REMINDER":
    case "BACKGROUND_CHECK_UPDATE":
      return prefs.emailCompliance;
    case "NEW_CLIENT_INQUIRY":
      return prefs.emailClientInquiries;
    case "OFF_PLATFORM_VIOLATION_NOTICE":
    case "CONTENT_MODERATION_NOTICE":
      return prefs.emailTrustSafety;
    case "BUG_REPORT_ACKNOWLEDGMENT":
      return prefs.emailProduct;
    default:
      return true;
  }
}
