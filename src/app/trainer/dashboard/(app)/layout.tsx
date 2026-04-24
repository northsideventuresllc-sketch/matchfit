import { redirect } from "next/navigation";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export default async function TrainerDashboardAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      profileImageUrl: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
        },
      },
    },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";

  const showComplianceInNav = isTrainerComplianceComplete(trainer.profile);

  return (
    <TrainerDashboardShell
      displayName={displayName}
      profileImageUrl={trainer.profileImageUrl}
      showComplianceInNav={showComplianceInNav}
    >
      {children}
    </TrainerDashboardShell>
  );
}
