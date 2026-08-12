import "server-only";

import { getStripe } from "@/lib/stripe-server";
import { prisma } from "@/lib/prisma";

/** Countries Stripe Connect Express supports (subset check happens Stripe-side too — this is a friendly pre-check). */
const DEFAULT_CONNECT_COUNTRY = "US";

/**
 * Creates the trainer's Stripe Connect Express account if one doesn't exist yet, and persists
 * its id. Idempotent — safe to call every time the trainer opens the payouts settings page.
 */
export async function getOrCreateTrainerConnectAccount(trainerId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Billing is not configured.");

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      stripeConnectAccountId: true,
      profile: { select: { countryCode: true } },
    },
  });
  if (!trainer) throw new Error("Trainer not found.");
  if (trainer.stripeConnectAccountId) return trainer.stripeConnectAccountId;

  const account = await stripe.accounts.create({
    type: "express",
    country: trainer.profile?.countryCode?.trim().toUpperCase() || DEFAULT_CONNECT_COUNTRY,
    email: trainer.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: { trainerId },
  });

  await prisma.trainer.update({
    where: { id: trainerId },
    data: { stripeConnectAccountId: account.id },
  });

  return account.id;
}

/** Stripe-hosted onboarding link. The trainer is redirected there, then back to `returnUrl`. */
export async function createTrainerConnectOnboardingLink(args: {
  trainerId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Billing is not configured.");

  const accountId = await getOrCreateTrainerConnectAccount(args.trainerId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: args.returnUrl,
    refresh_url: args.refreshUrl,
    type: "account_onboarding",
  });
  return { url: link.url };
}

/**
 * Pulls the latest status off a Connect account and mirrors it onto the trainer row. Called
 * from the return-from-onboarding route and from the `account.updated` Connect webhook — both
 * are just "go check Stripe again," so this is the one place that writes these fields.
 */
export async function syncTrainerConnectAccountStatus(accountId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Billing is not configured.");

  const account = await stripe.accounts.retrieve(accountId);
  const trainer = await prisma.trainer.findUnique({
    where: { stripeConnectAccountId: accountId },
    select: { id: true, stripeConnectOnboardingCompletedAt: true },
  });
  if (!trainer) return;

  const payoutsEnabled = account.payouts_enabled === true;
  const chargesEnabled = account.charges_enabled === true;
  const requirementsDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  await prisma.trainer.update({
    where: { id: trainer.id },
    data: {
      stripeConnectPayoutsEnabled: payoutsEnabled,
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectRequirementsDueJson: requirementsDue.length ? JSON.stringify(requirementsDue) : null,
      stripeConnectDisabledReason: disabledReason,
      stripeConnectOnboardingCompletedAt:
        payoutsEnabled && !trainer.stripeConnectOnboardingCompletedAt ? new Date() : undefined,
    },
  });
}

export type TrainerConnectStatus = {
  connected: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

export async function getTrainerConnectStatus(trainerId: string): Promise<TrainerConnectStatus> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsDueJson: true,
      stripeConnectDisabledReason: true,
    },
  });
  if (!trainer?.stripeConnectAccountId) {
    return { connected: false, payoutsEnabled: false, requirementsDue: [], disabledReason: null };
  }
  let requirementsDue: string[] = [];
  if (trainer.stripeConnectRequirementsDueJson) {
    try {
      requirementsDue = JSON.parse(trainer.stripeConnectRequirementsDueJson);
    } catch {
      requirementsDue = [];
    }
  }
  return {
    connected: true,
    payoutsEnabled: trainer.stripeConnectPayoutsEnabled,
    requirementsDue,
    disabledReason: trainer.stripeConnectDisabledReason,
  };
}
