import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminImpersonationStrip } from "@/components/admin/admin-impersonation-strip";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { ensureInternalQaTrainerFullCompliance } from "@/lib/internal-qa-trainer-compliance";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import {
  isMatchFitInternalQaEnabled,
  isMatchFitInternalQaTrainerEmail,
} from "@/lib/match-fit-internal-qa";
import { prisma } from "@/lib/prisma";
import { purgeExpiredSuspensionRecords } from "@/lib/suspension-lifecycle";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId, getVerifiedAdminImpersonation } from "@/lib/session";

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
      email: true,
      profileImageUrl: true,
      safetySuspended: true,
      deidentifiedAt: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          backgroundCheckClearedAt: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
          premiumStudioEnabledAt: true,
          dashboardActivatedAt: true,
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

  if (isMatchFitInternalQaEnabled() && isMatchFitInternalQaTrainerEmail(trainer.email)) {
    await ensureInternalQaTrainerFullCompliance(trainerId);
    const refreshed = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        firstName: true,
        lastName: true,
        preferredName: true,
        username: true,
        email: true,
        profileImageUrl: true,
        profile: {
          select: {
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            premiumStudioEnabledAt: true,
            dashboardActivatedAt: true,
          },
        },
      },
    });
    if (refreshed) {
      Object.assign(trainer, refreshed);
    }
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

  let supportStrip: ReactNode = null;
  const adminImp = await getVerifiedAdminImpersonation();
  if (adminImp?.role === "trainer") {
    const subject = await prisma.trainer.findUnique({
      where: { id: adminImp.targetId },
      select: { username: true },
    });
    if (subject) {
      supportStrip = (
        <AdminImpersonationStrip portalRole="trainer" username={subject.username} testMode={adminImp.testMode} />
      );
    }
  }

  return (
    <TrainerDashboardShell
      displayName={displayName}
      profileImageUrl={trainer.profileImageUrl}
      initialUnreadCount={unreadCount}
      premiumStudioActive={premiumStudioActive}
      showComplianceInNav={showComplianceInNav}
      supportStrip={supportStrip}
    >
      {children}
    </TrainerDashboardShell>
  );
}
