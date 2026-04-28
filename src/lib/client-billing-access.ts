type BillingFields = {
  stripeSubscriptionId: string | null;
  stripeSubscriptionActive: boolean;
  subscriptionGraceUntil: Date | null;
};

/** When true, client may only use billing-related dashboard routes until they renew. */
export function isClientBillingHardLocked(client: BillingFields): boolean {
  if (!client.stripeSubscriptionId?.trim()) {
    return false;
  }
  if (client.stripeSubscriptionActive) {
    return false;
  }
  if (!client.subscriptionGraceUntil) {
    return false;
  }
  return client.subscriptionGraceUntil.getTime() < Date.now();
}

export function billingExemptDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith("/client/dashboard/billing") ||
    pathname.startsWith("/client/dashboard/notification-settings") ||
    pathname.startsWith("/client/dashboard/notifications") ||
    pathname.startsWith("/client/dashboard/fithub") ||
    pathname.startsWith("/client/dashboard/daily-questionnaire") ||
    pathname.startsWith("/client/dashboard/preferences/onboarding")
  );
}
