import { PLATFORM_ADMIN_FEE_PERCENT, TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD } from "@/lib/tos-implementation-contract";

export function formatClientPlatformSubscriptionUsd(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD);
}

/** Client platform subscription checkout / marketing (no payment-processor brand names). */
export const CLIENT_PLATFORM_SUBSCRIPTION_FEE_DISCLOSURE =
  `Your monthly platform subscription does not include Match Fit's ${PLATFORM_ADMIN_FEE_PERCENT}% administrative fee—that fee applies only to coach services and other non-subscription purchases. Card processing fees apply to every charge on the platform, including subscriptions, as shown at checkout.`;

/** Shorter variant for homepage and compact UI. */
export const CLIENT_PLATFORM_SUBSCRIPTION_FEE_DISCLOSURE_SHORT =
  `The ${formatClientPlatformSubscriptionUsd()} monthly access fee excludes the ${PLATFORM_ADMIN_FEE_PERCENT}% administrative fee on coach purchases; card processing fees still apply at checkout.`;
