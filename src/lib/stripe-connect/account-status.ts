import { getStripeConnectClient } from "./client";

export type ConnectAccountStatus = {
  accountId: string;
  displayName: string | null;
  contactEmail: string | null;
  readyToProcessPayments: boolean;
  cardPaymentsStatus: string | null;
  requirementsStatus: string | null;
  onboardingComplete: boolean;
};

/**
 * Loads onboarding / capability state from the V2 Accounts API (never cached in this demo).
 */
export async function fetchConnectAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
  const stripeClient = getStripeConnectClient();

  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });

  const cardPaymentsStatus =
    account.configuration?.merchant?.capabilities?.card_payments?.status ?? null;

  const readyToProcessPayments = cardPaymentsStatus === "active";

  const requirementsStatus =
    account.requirements?.summary?.minimum_deadline?.status ?? null;

  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";

  return {
    accountId: account.id,
    displayName: account.display_name ?? null,
    contactEmail: account.contact_email ?? null,
    readyToProcessPayments,
    cardPaymentsStatus,
    requirementsStatus,
    onboardingComplete,
  };
}

/** Request options for connected-account (direct charge) API calls — sets the Stripe-Account header. */
export function connectAccountRequestOptions(accountId: string): { stripeAccount: string } {
  return { stripeAccount: accountId };
}
