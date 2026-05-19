import { getAppOriginFromRequest } from "@/lib/app-origin";
import {
  formatUsdFromCents,
  trainerBackgroundCheckCheckoutTotals,
  trainerBackgroundCheckFeeCents,
  trainerSignupBalanceCheckoutTotals,
} from "@/lib/trainer-onboarding-fees";
import { stripeLineItemsFromMarketplaceTotals } from "@/lib/platform-fees";
import { initiateTrainerCheckrScreening } from "@/lib/checkr/initiate-trainer-screening";
import { LAUNCH_TRAINER_PREMIUM_DAYS } from "@/lib/match-fit-launch-cohort";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import type Stripe from "stripe";

export async function createTrainerBackgroundCheckCheckoutSession(args: {
  trainerId: string;
  email: string;
  launchCohort: boolean;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Billing is not configured.");

  const totals = trainerBackgroundCheckCheckoutTotals(args.launchCohort);
  const line_items = stripeLineItemsFromMarketplaceTotals({
    totals,
    includeAdminFee: true,
    baseLine: {
      name: "Trainer background screening",
      description: `Third-party background check (${formatUsdFromCents(trainerBackgroundCheckFeeCents())}, ex tax).`,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.email,
    line_items,
    metadata: {
      purpose: "trainer_background_check",
      trainerId: args.trainerId,
      launchCohort: args.launchCohort ? "1" : "0",
      baseCents: String(totals.baseCents),
      adminFeeCents: String(totals.adminCents),
      processingFeeCents: String(totals.processingCents),
      totalChargedCents: String(totals.totalCents),
    },
    success_url: `${args.origin}/trainer/onboarding?background_check_paid=1`,
    cancel_url: `${args.origin}/trainer/onboarding?background_check_canceled=1`,
  });
  if (!session.url) throw new Error("Could not start checkout.");
  return session.url;
}

export async function createTrainerSignupBalanceCheckoutSession(args: {
  trainerId: string;
  email: string;
  backgroundCheckPaidCents: number;
  launchCohort: boolean;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Billing is not configured.");

  const totals = trainerSignupBalanceCheckoutTotals({
    backgroundCheckPaidCents: args.backgroundCheckPaidCents,
    launchCohort: args.launchCohort,
  });
  if (!totals) throw new Error("No registration balance is due.");

  const balanceDescription = args.launchCohort
    ? "Launch coach registration fee (20% of $100.00, ex tax)."
    : "Remaining Match Fit trainer registration fee after background-check credit.";

  const line_items = stripeLineItemsFromMarketplaceTotals({
    totals,
    includeAdminFee: false,
    baseLine: {
      name: "Trainer registration fee balance",
      description: balanceDescription,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.email,
    line_items,
    metadata: {
      purpose: "trainer_signup_balance",
      trainerId: args.trainerId,
      launchCohort: args.launchCohort ? "1" : "0",
      baseCents: String(totals.baseCents),
      processingFeeCents: String(totals.processingCents),
      totalChargedCents: String(totals.totalCents),
    },
    success_url: `${args.origin}/trainer/onboarding?signup_fee_paid=1`,
    cancel_url: `${args.origin}/trainer/onboarding?signup_fee_canceled=1`,
  });
  if (!session.url) throw new Error("Could not start checkout.");
  return session.url;
}

export function trainerOnboardingOriginFromRequest(req: Request): string {
  return getAppOriginFromRequest(req);
}

export async function handleTrainerOnboardingCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const md = session.metadata ?? {};
  const trainerId = md.trainerId?.trim();
  if (!trainerId || session.payment_status !== "paid") return;

  if (md.purpose === "trainer_background_check") {
    const baseCents = Math.max(0, parseInt(String(md.baseCents ?? "0"), 10) || 0);
    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        hasPaidBackgroundFee: true,
        backgroundCheckPaidCents: baseCents || trainerBackgroundCheckFeeCents(),
        backgroundCheckStatus: "PENDING",
        backgroundCheckReviewStatus: "PENDING",
      },
      update: {
        hasPaidBackgroundFee: true,
        backgroundCheckPaidCents: baseCents || trainerBackgroundCheckFeeCents(),
        backgroundCheckStatus: "PENDING",
        backgroundCheckReviewStatus: "PENDING",
      },
    });

    try {
      await initiateTrainerCheckrScreening(trainerId);
    } catch (e) {
      console.error("[trainer onboarding] Checkr initiate after payment", e);
    }
    return;
  }

  if (md.purpose === "trainer_signup_balance") {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { signupFeeBalancePaidAt: new Date() },
    });
  }
}

export function launchTrainerPremiumEndsAtFromSignup(): Date {
  const d = new Date();
  d.setDate(d.getDate() + LAUNCH_TRAINER_PREMIUM_DAYS);
  return d;
}
