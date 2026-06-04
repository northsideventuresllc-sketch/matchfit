import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
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
    },
  });

  if (!profile?.hasSignedTOS) {
    redirect("/trainer/signup/terms");
  }

  const next = resolveTrainerSignupNextPath(profile);
  if (next === "/trainer/dashboard") {
    redirect("/trainer/dashboard");
  }

  return (
    <TrainerSignupPaymentClient
      foundingPricing={profile.registrationFeePricingMode === "FOUNDING_BG_SURCHARGE_20PCT"}
    />
  );
}
