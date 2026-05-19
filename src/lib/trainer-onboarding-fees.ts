import { TOS_TRAINER_SIGNUP_FEE_USD } from "@/lib/tos-implementation-contract";
import {
  adminFeeCentsFromBaseSubtotalCents,
  buildMarketplaceCheckoutTotals,
} from "@/lib/platform-fees";

export const TRAINER_SIGNUP_FEE_CENTS = Math.round(TOS_TRAINER_SIGNUP_FEE_USD * 100);

/** First 10 successfully onboarded trainers pay 20% of the $100 registration fee (ex tax). */
export const LAUNCH_COHORT_SIGNUP_FEE_RATE = 0.2;

export function trainerLaunchCohortSignupBalanceCents(): number {
  return Math.round(TRAINER_SIGNUP_FEE_CENTS * LAUNCH_COHORT_SIGNUP_FEE_RATE);
}

/** Background check list price (USD, ex tax) from env — see `.env.example`. */
export function trainerBackgroundCheckFeeCents(): number {
  const fromEnv = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD?.trim();
  const usd = fromEnv ? Number.parseFloat(fromEnv) : 49;
  if (!Number.isFinite(usd) || usd <= 0) return 4900;
  return Math.round(usd * 100);
}

export function trainerSignupFeeBalanceDueCents(args: {
  backgroundCheckPaidCents: number;
  launchCohort: boolean;
}): number {
  if (args.launchCohort) {
    return trainerLaunchCohortSignupBalanceCents();
  }
  return Math.max(0, TRAINER_SIGNUP_FEE_CENTS - Math.max(0, args.backgroundCheckPaidCents));
}

/** Background check checkout: list price + 20% admin + card processing (launch and standard). */
export function trainerBackgroundCheckCheckoutTotals(launchCohort: boolean): {
  baseCents: number;
  adminCents: number;
  processingCents: number;
  totalCents: number;
} {
  const baseCents = trainerBackgroundCheckFeeCents();
  return buildMarketplaceCheckoutTotals(baseCents, { includeAdminFee: true });
}

export function trainerSignupBalanceCheckoutTotals(args: {
  backgroundCheckPaidCents: number;
  launchCohort: boolean;
}): {
  baseCents: number;
  adminCents: number;
  processingCents: number;
  totalCents: number;
} | null {
  const baseCents = trainerSignupFeeBalanceDueCents(args);
  if (baseCents <= 0) return null;
  return buildMarketplaceCheckoutTotals(baseCents, { includeAdminFee: false });
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function trainerOnboardingFeeSummaryCopy(args: {
  launchCohort: boolean;
  backgroundCheckPaidCents: number;
}): string {
  const bg = formatUsdFromCents(trainerBackgroundCheckFeeCents());
  const signup = formatUsdFromCents(TRAINER_SIGNUP_FEE_CENTS);
  const processingNote = "Card processing fees are added at checkout.";
  if (args.launchCohort) {
    const launchBalance = formatUsdFromCents(trainerLaunchCohortSignupBalanceCents());
    return `Launch pricing (first 10 coaches): pay ${bg} for your background check plus Match Fit administrative and card processing fees. After screening clears and certifications are verified, pay ${launchBalance} (20% of the ${signup} registration fee, ex tax) plus ${processingNote}`;
  }
  const balance = trainerSignupFeeBalanceDueCents({
    backgroundCheckPaidCents: args.backgroundCheckPaidCents,
    launchCohort: false,
  });
  if (balance <= 0) {
    return `Your background check payment satisfied the ${signup} trainer registration fee.`;
  }
  return `Pay ${bg} for your background check (credited toward the ${signup} registration fee, ex tax) plus administrative and ${processingNote} After screening clears and certifications are verified, pay the remaining ${formatUsdFromCents(balance)} plus ${processingNote}`;
}
