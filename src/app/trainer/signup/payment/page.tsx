import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { stripeConfigHealth } from "@/lib/stripe-config";
import { getStripePublishableKey } from "@/lib/stripe-publishable";
import { trainerOnboardingFeeIsPaid } from "@/lib/trainer-onboarding-fee-deadline";
import TrainerSignupPaymentClient from "./trainer-signup-payment-client";

export const dynamic = "force-dynamic";

export default async function TrainerSignupPaymentPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/signup");
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
      registrationFeePricingMode: true,
      registrationFeeWaived: true,
      onboardingFeePaymentDeadlineAt: true,
    },
  });

  if (!profile?.hasSignedTOS) {
    redirect("/trainer/signup/terms");
  }

  if (trainerOnboardingFeeIsPaid(profile)) {
    redirect("/trainer/dashboard");
  }

  const stripeHealth = stripeConfigHealth();

  return (
    <TrainerSignupPaymentClient
      foundingPricing={profile.registrationFeePricingMode === "FOUNDING_BG_SURCHARGE_20PCT"}
      stripePublishableKey={getStripePublishableKey()}
      stripeSecretConfigured={stripeHealth.stripeSecretConfigured}
    />
  );
}
