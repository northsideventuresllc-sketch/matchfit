import { redirect } from "next/navigation";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";
import { purgeExpiredSuspensionRecords } from "@/lib/suspension-lifecycle";
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
  await purgeExpiredSuspensionRecords();

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      username: true,
      profileImageUrl: true,
      safetySuspended: true,
      deidentifiedAt: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
          premiumStudioEnabledAt: true,
        },
      },
    },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  if (trainer.deidentifiedAt) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  if (trainer.safetySuspended) {
    redirect("/trainer/account-suspended");
  }
  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";

  const showComplianceInNav = isTrainerComplianceComplete(trainer.profile);

  const unreadCount = await prisma.trainerNotification.count({
    where: { trainerId, readAt: null },
  });

  const premiumStudioActive = Boolean(trainer.profile?.premiumStudioEnabledAt);

  return (
    <TrainerDashboardShell
      displayName={displayName}
      profileImageUrl={trainer.profileImageUrl}
      initialUnreadCount={unreadCount}
      premiumStudioActive={premiumStudioActive}
      showComplianceInNav={showComplianceInNav}
    >
      {children}
    </TrainerDashboardShell>
  );
}
