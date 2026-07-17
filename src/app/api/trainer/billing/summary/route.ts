import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  resolveTrainerPlatformAccessPhase,
  trainerNeedsPaymentSetup,
} from "@/lib/trainer-platform-access";
import { syncTrainerPlatformBillingLifecycle } from "@/lib/trainer-platform-lifecycle";
import {
  TRAINER_PAYMENT_GRACE_DAYS,
  TRAINER_PLATFORM_SUBSCRIPTION_USD,
  TRAINER_PLATFORM_TRIAL_DAYS,
  trainerPlatformSubscriptionLabel,
} from "@/lib/trainer-platform-trial-constants";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { NextResponse } from "next/server";

/**
 * Trainer Independent Pro billing summary.
 */
export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await syncTrainerPlatformBillingLifecycle(trainerId);

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: true,
        platformTrialEndsAt: true,
        paymentGraceUntil: true,
        accountDeactivatedAt: true,
        platformTrialConsumed: true,
        profile: {
          select: {
            premiumStudioEnabledAt: true,
            fitHubPromoEndsAt: true,
          },
        },
      },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const billingFields = {
      stripeSubscriptionId: trainer.stripeSubscriptionId,
      stripeSubscriptionActive: trainer.stripeSubscriptionActive,
      subscriptionGraceUntil: trainer.subscriptionGraceUntil,
      platformTrialEndsAt: trainer.platformTrialEndsAt,
      paymentGraceUntil: trainer.paymentGraceUntil,
      accountDeactivatedAt: trainer.accountDeactivatedAt,
      platformTrialConsumed: trainer.platformTrialConsumed,
    };
    const phase = resolveTrainerPlatformAccessPhase(billingFields);
    const premiumStudioActive = await isTrainerPremiumStudioActive(trainerId);
    const needsPayment = trainerNeedsPaymentSetup(billingFields);

    let message: string;
    if (phase === "paid") {
      message = `Your Independent Pro subscription (${trainerPlatformSubscriptionLabel()}) is active.`;
    } else if (phase === "platform_trial") {
      message = `You are on your ${TRAINER_PLATFORM_TRIAL_DAYS}-day free Independent Pro trial. After the trial, ${trainerPlatformSubscriptionLabel()} keeps your account active.`;
    } else if (phase === "payment_grace") {
      message = `Your free trial has ended. Start the ${trainerPlatformSubscriptionLabel()} subscription within ${TRAINER_PAYMENT_GRACE_DAYS} days to keep your account active.`;
    } else if (phase === "stripe_lapsed_grace") {
      message = "Your subscription payment failed. Update your payment method to keep your account active.";
    } else {
      message =
        "Your Independent Pro account is deactivated. Subscribe to reactivate and restore dashboard access.";
    }

    return NextResponse.json({
      mode: "live" as const,
      email: trainer.email,
      hasStripeCustomer: Boolean(trainer.stripeCustomerId?.trim()),
      hasActiveSubscription: trainer.stripeSubscriptionActive && Boolean(trainer.stripeSubscriptionId?.trim()),
      stripeSubscriptionActive: trainer.stripeSubscriptionActive,
      platformTrialEndsAt: trainer.platformTrialEndsAt?.toISOString() ?? null,
      paymentGraceUntil: trainer.paymentGraceUntil?.toISOString() ?? null,
      subscriptionGraceUntil: trainer.subscriptionGraceUntil?.toISOString() ?? null,
      accountDeactivatedAt: trainer.accountDeactivatedAt?.toISOString() ?? null,
      accessPhase: phase,
      needsPayment,
      monthlyPriceUsd: TRAINER_PLATFORM_SUBSCRIPTION_USD,
      trialDays: TRAINER_PLATFORM_TRIAL_DAYS,
      paymentGraceDays: TRAINER_PAYMENT_GRACE_DAYS,
      premiumStudioActive,
      premiumStudioEnabledAt: trainer.profile?.premiumStudioEnabledAt?.toISOString() ?? null,
      fitHubPromoEndsAt: trainer.profile?.fitHubPromoEndsAt?.toISOString() ?? null,
      message,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load billing summary." }, { status: 500 });
  }
}
