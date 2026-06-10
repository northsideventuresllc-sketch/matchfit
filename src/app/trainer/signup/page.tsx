import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import TrainerSignUpClient, { type TrainerSignupResumeAccount } from "./trainer-sign-up-client";

export default async function TrainerSignUpPage() {
  const trainerId = await getSessionTrainerId();
  let resumeAccount: TrainerSignupResumeAccount | undefined;

  if (trainerId) {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        phone: true,
        profile: {
          select: {
            hasSignedTOS: true,
            registrationFeeHoldStatus: true,
            hasPaidRegistrationFee: true,
            limitedDashboardUnlockedAt: true,
          },
        },
      },
    });
    if (!trainer) {
      redirect(staleTrainerSessionInvalidateRedirect("/trainer/signup"));
    }

    const signupNext = resolveTrainerSignupNextPath(trainer.profile);
    if (signupNext === "/trainer/dashboard") {
      redirect("/trainer/dashboard");
    }

    resumeAccount = {
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      username: trainer.username,
      email: trainer.email,
      phone: trainer.phone,
      hasSignedTOS: trainer.profile?.hasSignedTOS ?? false,
      signupFeeComplete: signupNext !== "/trainer/signup/payment",
    };
  }

  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B0C0F]" aria-hidden />}>
      <TrainerSignUpClient resumeAccount={resumeAccount} />
    </Suspense>
  );
}
