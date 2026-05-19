import { subscriptionTrialEndFromStripe } from "@/lib/client-subscription-trial";
import type { ClientTrialPlan } from "@/lib/match-fit-launch-cohort";
import { BetaCapExceededError, assertClientBetaSlotForFinalize } from "@/lib/beta-cap-enforcement";
import { notifyClientMembershipTrialStarted } from "@/lib/client-membership-email-notify";
import { getClientFoundingTrialDays } from "@/lib/match-fit-launch-promotions";
import { prisma } from "@/lib/prisma";
import { syncClientSubscriptionFromStripe } from "@/lib/stripe-sync-client-subscription";
import { getStripe } from "@/lib/stripe-server";
import { isMatchFitInternalQaClientEmail } from "@/lib/match-fit-internal-qa";

export type FinalizeResult =
  | { ok: true; clientId: string; alreadyCompleted?: boolean }
  | { ok: false; error: string };

/**
 * Creates the Client row only after Stripe reports an active paid subscription.
 * Idempotent for duplicate webhook / activate calls.
 */
export async function finalizeRegistrationAfterPayment(subscriptionId: string): Promise<FinalizeResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Billing is not configured." };
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  const existingBySub = await prisma.client.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (existingBySub) {
    return { ok: true, clientId: existingBySub.id, alreadyCompleted: true };
  }

  const holdId = sub.metadata?.holdId;
  if (!holdId || typeof holdId !== "string") {
    return { ok: false, error: "Invalid subscription metadata." };
  }

  if (sub.status !== "active" && sub.status !== "trialing") {
    return { ok: false, error: "Subscription is not active yet." };
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const hold = await prisma.pendingClientRegistration.findUnique({
    where: { id: holdId },
  });

  if (!hold) {
    return { ok: false, error: "This registration is no longer available." };
  }

  if (hold.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "Registration is not awaiting payment." };
  }

  if (hold.stripeSubscriptionId && hold.stripeSubscriptionId !== subscriptionId) {
    return { ok: false, error: "Subscription does not match this checkout session." };
  }

  const twoFactorEnabled = hold.twoFactorEnabled;
  const twoFactorMethod = twoFactorEnabled ? hold.twoFactorMethod : "NONE";
  const trialPlan = (hold.clientTrialPlan ?? sub.metadata?.clientTrialPlan ?? "NONE") as ClientTrialPlan;
  const launchCohortMember = hold.launchCohortMember || trialPlan === "LAUNCH_7D";
  const subscriptionTrialEndsAt = subscriptionTrialEndFromStripe(sub);
  const paidAt =
    sub.status === "active" && !subscriptionTrialEndsAt ? new Date() : null;
  const betaWl = hold.betaClientWaitlistEntryId;

  try {
    const client = await prisma.$transaction(async (tx) => {
      await assertClientBetaSlotForFinalize(tx, betaWl);
      const c = await tx.client.create({
        data: {
          firstName: hold.firstName,
          lastName: hold.lastName,
          preferredName: hold.preferredName,
          username: hold.username,
          phone: hold.phone,
          email: hold.email,
          passwordHash: hold.passwordHash,
          zipCode: hold.zipCode,
          dateOfBirth: hold.dateOfBirth,
          termsAcceptedAt: hold.termsAcceptedAt,
          privacyPolicyAcceptedAt: hold.privacyPolicyAcceptedAt ?? hold.termsAcceptedAt,
          twoFactorEnabled,
          twoFactorMethod,
          stayLoggedIn: hold.stayLoggedIn,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionActive: true,
          subscriptionGraceUntil: null,
          stripeLastSubscriptionInvoicePaidAt: paidAt,
          launchCohortMember,
          clientTrialPlan: trialPlan,
          subscriptionTrialEndsAt,
          stripeLastSubscriptionInvoicePaidAt: new Date(),
        },
      });
      await tx.pendingClientRegistration.delete({ where: { id: hold.id } });
      if (betaWl) {
        await tx.betaClientWaitlistEntry.updateMany({
          where: { id: betaWl, status: "INVITED" },
          data: {
            status: "REGISTERED",
            registeredClientId: c.id,
            updatedAt: new Date(),
          },
        });
      }
      return c;
    }, { isolationLevel: "Serializable" });

    if (sub.status === "trialing") {
      const trialEndUnix = sub.trial_end;
      const trialEnd =
        typeof trialEndUnix === "number" && trialEndUnix > 0 ? new Date(trialEndUnix * 1000) : null;
      const founding =
        sub.metadata?.matchFitFoundingTrial === "1" || sub.metadata?.matchFitBillingChoice === "founding_trial_14d";
      const trialDays =
        founding && trialEnd
          ? Math.max(1, Math.round((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : getClientFoundingTrialDays();
      void notifyClientMembershipTrialStarted({
        clientId: client.id,
        email: hold.email,
        trialDays,
        trialEndLabel: trialEnd
          ? trialEnd.toLocaleDateString("en-US", { dateStyle: "long" })
          : "when your trial ends",
        foundingSlot: founding,
      });
    }

    await syncClientSubscriptionFromStripe(subscriptionId);
    return { ok: true, clientId: client.id };
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return { ok: false, error: e.message };
    }
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const existing = await prisma.client.findUnique({ where: { email: hold.email } });
      if (existing) {
        await prisma.pendingClientRegistration.deleteMany({ where: { id: hold.id } });
        await syncClientSubscriptionFromStripe(subscriptionId);
        return { ok: true, clientId: existing.id, alreadyCompleted: true };
      }
    }
    console.error(e);
    return { ok: false, error: "Could not finalize your account." };
  }
}

/**
 * Internal QA only: creates the `Client` row from a pending registration without Stripe when the owner
 * verifies their account password (see `/api/client/billing/internal-qa-complete-registration`).
 */
export async function finalizeInternalQaClientRegistrationFromHold(holdId: string): Promise<FinalizeResult> {
  const hold = await prisma.pendingClientRegistration.findUnique({
    where: { id: holdId },
  });
  if (!hold) {
    return { ok: false, error: "This registration is no longer available." };
  }
  if (!isMatchFitInternalQaClientEmail(hold.email)) {
    return { ok: false, error: "This bypass is not available for this account." };
  }
  if (hold.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "Registration is not awaiting payment." };
  }

  const existing = await prisma.client.findUnique({ where: { email: hold.email } });
  if (existing) {
    await prisma.pendingClientRegistration.deleteMany({ where: { id: hold.id } });
    return { ok: true, clientId: existing.id, alreadyCompleted: true };
  }

  const twoFactorEnabled = hold.twoFactorEnabled;
  const twoFactorMethod = twoFactorEnabled ? hold.twoFactorMethod : "NONE";

  try {
    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: {
          firstName: hold.firstName,
          lastName: hold.lastName,
          preferredName: hold.preferredName,
          username: hold.username,
          phone: hold.phone,
          email: hold.email,
          passwordHash: hold.passwordHash,
          zipCode: hold.zipCode,
          dateOfBirth: hold.dateOfBirth,
          termsAcceptedAt: hold.termsAcceptedAt,
          privacyPolicyAcceptedAt: hold.privacyPolicyAcceptedAt ?? hold.termsAcceptedAt,
          twoFactorEnabled,
          twoFactorMethod,
          stayLoggedIn: hold.stayLoggedIn,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeSubscriptionActive: true,
          subscriptionGraceUntil: null,
          stripeLastSubscriptionInvoicePaidAt: new Date(),
        },
      });
      await tx.pendingClientRegistration.delete({ where: { id: hold.id } });
      return c;
    });

    return { ok: true, clientId: client.id };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const ex = await prisma.client.findUnique({ where: { email: hold.email } });
      if (ex) {
        await prisma.pendingClientRegistration.deleteMany({ where: { id: hold.id } });
        return { ok: true, clientId: ex.id, alreadyCompleted: true };
      }
    }
    console.error(e);
    return { ok: false, error: "Could not finalize your account." };
  }
}
