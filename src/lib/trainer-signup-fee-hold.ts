import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import {
  computeTrainerSignupBackgroundEscrowHoldCents,
  computeTrainerSignupCaptureOnSuccessCents,
  computeTrainerSignupCombinedHoldCents,
  computeTrainerSignupEscrowSplit,
  computeTrainerSignupPlatformHoldCents,
  signupEscrowMetadata,
} from "@/lib/trainer-signup-escrow";
import { getStripe } from "@/lib/stripe-server";

/** Legacy combined signup hold (single PaymentIntent for full signup total). */
export const TRAINER_SIGNUP_FEE_HOLD_PURPOSE = "trainer_signup_fee_hold";
/** Platform onboarding slice — held until compliance review succeeds. */
export const TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE = "trainer_signup_platform_hold";
/** Background-check slice — captured when Checkr screening completes (pass or fail). */
export const TRAINER_SIGNUP_BG_ESCROW_PURPOSE = "trainer_signup_bg_escrow";

export type TrainerSignupFeeHoldIntents = {
  platformClientSecret: string;
  platformPaymentIntentId: string;
  backgroundCheckClientSecret: string;
  backgroundCheckPaymentIntentId: string;
  baseCents: number;
  totalCents: number;
  platformHoldCents: number;
  backgroundCheckHoldCents: number;
};

function isManualCaptureReady(status: string): boolean {
  return status === "requires_capture" || status === "succeeded";
}

/** Base platform amount due at signup (cents, before processing fee). */
export function computeTrainerSignupFeeBaseCents(pricingMode: TrainerRegistrationPricingMode): number {
  return computeTrainerSignupEscrowSplit(pricingMode).baseCents;
}

export function isTrainerSignupPlatformHoldPaymentIntent(pi: { metadata?: Record<string, string> | null }): boolean {
  const purpose = pi.metadata?.purpose?.trim();
  return purpose === TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE || purpose === TRAINER_SIGNUP_FEE_HOLD_PURPOSE;
}

export function isTrainerSignupBackgroundEscrowPaymentIntent(pi: { metadata?: Record<string, string> | null }): boolean {
  return pi.metadata?.purpose?.trim() === TRAINER_SIGNUP_BG_ESCROW_PURPOSE;
}

export function isLegacyCombinedTrainerSignupHoldPaymentIntent(pi: {
  metadata?: Record<string, string> | null;
}): boolean {
  return pi.metadata?.purpose?.trim() === TRAINER_SIGNUP_FEE_HOLD_PURPOSE;
}

async function createManualCapturePaymentIntent(args: {
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const pi = await stripe.paymentIntents.create({
    amount: Math.max(1, Math.floor(args.amountCents)),
    currency: "usd",
    receipt_email: args.email,
    capture_method: "manual",
    automatic_payment_methods: { enabled: true },
    metadata: args.metadata,
  });

  if (!pi.client_secret) {
    throw new Error("Stripe did not return a client secret for this payment.");
  }

  return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
}

/** Creates only the background-check escrow PaymentIntent (manual capture). */
export async function createTrainerSignupBackgroundEscrowPaymentIntent(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
}): Promise<{ clientSecret: string; paymentIntentId: string; holdCents: number }> {
  const split = computeTrainerSignupEscrowSplit(args.pricingMode);
  const holdCents = computeTrainerSignupBackgroundEscrowHoldCents(args.pricingMode);
  const escrowMeta = signupEscrowMetadata(args.pricingMode);
  const pi = await createManualCapturePaymentIntent({
    amountCents: holdCents,
    email: args.email,
    metadata: {
      purpose: TRAINER_SIGNUP_BG_ESCROW_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
      holdSlice: "background_check",
      backgroundCheckEscrowCents: String(split.backgroundCheckEscrowCents),
      backgroundCheckHoldCents: String(holdCents),
      ...escrowMeta,
    },
  });
  return { ...pi, holdCents };
}

/** Creates separate platform + background-check holds so each slice can be captured independently. */
export async function createTrainerSignupFeeHoldPaymentIntents(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
}): Promise<TrainerSignupFeeHoldIntents> {
  const split = computeTrainerSignupEscrowSplit(args.pricingMode);
  const platformHoldCents = computeTrainerSignupPlatformHoldCents(args.pricingMode);
  const escrowMeta = signupEscrowMetadata(args.pricingMode);

  const backgroundCheck = await createTrainerSignupBackgroundEscrowPaymentIntent(args);

  const platform = await createManualCapturePaymentIntent({
    amountCents: platformHoldCents,
    email: args.email,
    metadata: {
      purpose: TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
      holdSlice: "platform",
      platformEscrowCents: String(split.platformEscrowCents),
      platformHoldCents: String(platformHoldCents),
      backgroundCheckPaymentIntentId: backgroundCheck.paymentIntentId,
      ...escrowMeta,
    },
  });

  return {
    platformClientSecret: platform.clientSecret,
    platformPaymentIntentId: platform.paymentIntentId,
    backgroundCheckClientSecret: backgroundCheck.clientSecret,
    backgroundCheckPaymentIntentId: backgroundCheck.paymentIntentId,
    backgroundCheckHoldCents: backgroundCheck.holdCents,
    baseCents: split.baseCents,
    totalCents: computeTrainerSignupCombinedHoldCents(args.pricingMode),
    platformHoldCents,
  };
}

/**
 * @deprecated Prefer `createTrainerSignupFeeHoldPaymentIntents`. Kept for legacy callers/tests.
 */
export async function createTrainerSignupFeeHoldPaymentIntent(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
}): Promise<{ clientSecret: string; paymentIntentId: string; baseCents: number; totalCents: number }> {
  const intents = await createTrainerSignupFeeHoldPaymentIntents(args);
  return {
    clientSecret: intents.platformClientSecret,
    paymentIntentId: intents.platformPaymentIntentId,
    baseCents: intents.baseCents,
    totalCents: intents.totalCents,
  };
}

export async function captureTrainerSignupFeeHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  await stripe.paymentIntents.capture(paymentIntentId);
}

/** Capture held signup fee when compliance succeeds (legacy combined PaymentIntent). */
export async function captureTrainerSignupFeeHoldOnComplianceSuccess(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const amount = computeTrainerSignupCaptureOnSuccessCents(pricingMode);
  await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
}

/** Capture the platform onboarding slice after certification + background check are approved. */
export async function captureTrainerSignupPlatformHold(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const amount = computeTrainerSignupPlatformHoldCents(pricingMode);
  await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
}

/** Capture the background-check escrow slice once Checkr screening has run (pass or fail). */
export async function captureTrainerSignupBackgroundEscrowHold(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const amount = computeTrainerSignupBackgroundEscrowHoldCents(pricingMode);
  await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
}

/** Release the uncaptured platform onboarding hold (review failed / account expired). */
export async function releaseTrainerSignupPlatformHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
  } catch {
    // Already captured or canceled — ignore.
  }
}

/**
 * @deprecated Legacy combined-intent path. Split holds capture background escrow separately and
 * release the platform hold on failure.
 */
export async function captureTrainerSignupFeeHoldPartial(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
  reason: "bg_failure",
): Promise<void> {
  void reason;
  await captureTrainerSignupPlatformHold(paymentIntentId, pricingMode);
}

export async function cancelTrainerSignupFeeHold(paymentIntentId: string): Promise<void> {
  await releaseTrainerSignupPlatformHold(paymentIntentId);
}

export async function retrieveTrainerSignupPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export function trainerSignupPaymentIntentReady(pi: { status: string }): boolean {
  return isManualCaptureReady(pi.status);
}
