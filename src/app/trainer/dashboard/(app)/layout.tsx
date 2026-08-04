import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminImpersonationStrip } from "@/components/admin/admin-impersonation-strip";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { TrainerEmailVerificationBanner } from "@/components/trainer/trainer-email-verification-banner";
import { TrainerTrialEndBanner } from "@/components/trainer/trainer-trial-end-banner";
import { FP_TIER_DISPLAY_NAMES } from "@/lib/fp-account-tier-types";
import { resolveTrainerTrialPrompt } from "@/lib/trainer-trial-decision";
import { isAccountDeletionGraceActive } from "@/lib/account-deletion-grace";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { trainerCanUseInAppChat } from "@/lib/fp-tier-chat-policy";
import { hasTrainerLimitedDashboardAccess } from "@/lib/trainer-full-access";
import {
  isTrainerBillingHardLocked,
  trainerBillingExemptDashboardPath,
} from "@/lib/trainer-platform-access";
import { syncTrainerPlatformBillingLifecycle } from "@/lib/trainer-platform-lifecycle";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
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
      emailVerifiedAt: true,
      profileImageUrl: true,
      safetySuspended: true,
      deidentifiedAt: true,
      accountDeletionRequestedAt: true,
      accountDeletionFinalizeAt: true,
      stripeSubscriptionId: true,
      stripeSubscriptionActive: true,
      subscriptionGraceUntil: true,
      platformTrialEndsAt: true,
      paymentGraceUntil: true,
      accountDeactivatedAt: true,
      platformTrialConsumed: true,
      platformBillingExempt: true,
      profile: {
        select: {
          hasSignedTOS: true,
          accountTier: true,
          docsSubmitted: true,
          docsApproved: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
          premiumStudioEnabledAt: true,
          registrationFeeHoldStatus: true,
          hasPaidRegistrationFee: true,
          limitedDashboardUnlockedAt: true,
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
  if (isAccountDeletionGraceActive(trainer)) {
    redirect("/trainer/account-deletion-scheduled");
  }
  if (trainer.safetySuspended) {
    redirect("/trainer/account-suspended");
  }

  await syncTrainerPlatformBillingLifecycle(trainerId);
  const billingTrainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      stripeSubscriptionId: true,
      stripeSubscriptionActive: true,
      subscriptionGraceUntil: true,
      platformTrialEndsAt: true,
      paymentGraceUntil: true,
      accountDeactivatedAt: true,
      platformTrialConsumed: true,
    },
  });
  if (!billingTrainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  if (billingTrainer.accountDeactivatedAt) {
    redirect("/trainer/reactivate");
  }

  const pathname = (await headers()).get("x-mf-pathname") ?? "";
  if (isTrainerBillingHardLocked(billingTrainer) && !trainerBillingExemptDashboardPath(pathname)) {
    redirect("/trainer/dashboard/billing?locked=1");
  }

  const signupNext = resolveTrainerSignupNextPath(trainer.profile);
  if (signupNext !== "/trainer/dashboard") {
    redirect(signupNext);
  }

  if (!hasTrainerLimitedDashboardAccess(trainer.profile) && !trainer.profile?.dashboardActivatedAt) {
    redirect("/trainer/onboarding");
  }
  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";

  const showComplianceInNav = isTrainerComplianceComplete(trainer.profile);
  const showChatsInNav = trainerCanUseInAppChat(trainer.profile?.accountTier);

  const unreadCount = await prisma.trainerNotification.count({
    where: { trainerId, readAt: null },
  });

  const premiumStudioActive = await isTrainerPremiumStudioActive(trainerId);

  // The founding cohort got their account type without paying, so the payment conversation
  // happens as the trial runs out rather than at sign-up.
  const trialPrompt = resolveTrainerTrialPrompt({
    accountTier: trainer.profile?.accountTier,
    platformTrialEndsAt: billingTrainer.platformTrialEndsAt,
    stripeSubscriptionActive: billingTrainer.stripeSubscriptionActive,
    platformBillingExempt: trainer.platformBillingExempt,
  });

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
      showChatsInNav={showChatsInNav}
      showComplianceInNav={showComplianceInNav}
      supportStrip={supportStrip}
    >
      {trialPrompt.kind === "none" ? null : (
        <div className="mb-4">
          <TrainerTrialEndBanner
            kind={trialPrompt.kind}
            tierLabel={
              trialPrompt.kind === "premium_choice"
                ? FP_TIER_DISPLAY_NAMES.match_fit_premium_pro
                : FP_TIER_DISPLAY_NAMES[trialPrompt.tier]
            }
            daysLeft={trialPrompt.daysLeft}
            expired={trialPrompt.expired}
          />
        </div>
      )}
      {trainer.emailVerifiedAt ? null : (
        <div className="mb-4">
          <TrainerEmailVerificationBanner email={trainer.email} />
        </div>
      )}
      {children}
    </TrainerDashboardShell>
  );
}
