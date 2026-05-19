import { prisma } from "@/lib/prisma";

/**
 * Internal QA only: soft-reset a primary client account to re-run onboarding while preserving credentials.
 * Does not touch synthetic personas or safety records.
 */
export async function resetInternalQaClientAccount(clientId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const convIds = await tx.trainerClientConversation.findMany({
      where: { clientId },
      select: { id: true },
    });
    const ids = convIds.map((c) => c.id);
    if (ids.length) {
      await tx.internalQaDeferredOfficialChat.deleteMany({ where: { conversationId: { in: ids } } });
      await tx.trainerClientChatMessage.deleteMany({ where: { conversationId: { in: ids } } });
      await tx.trainerClientConversation.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.trainerClientNudge.deleteMany({ where: { clientId } });
    await tx.clientSavedTrainer.deleteMany({ where: { clientId } });
    await tx.clientTrainerBrowsePass.deleteMany({ where: { clientId } });

    await tx.webPushSubscription.deleteMany({ where: { clientId } });
    await tx.clientTwoFactorChannel.deleteMany({ where: { clientId } });

    await tx.client.update({
      where: { id: clientId },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionActive: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        matchPreferencesJson: null,
        matchPreferencesCompletedAt: null,
        allowTrainerDiscovery: true,
        bio: null,
        profileImageUrl: null,
        fitHubPrefsJson: null,
        dailyAlgorithmContextJson: null,
        optionalProfileVisibilityJson: null,
        dashboardQuickLinkIdsJson: null,
        notificationPrefsJson: null,
        addressLine1: null,
        addressLine2: null,
        addressCity: null,
        addressState: null,
        addressPostal: null,
        addressCountry: null,
      },
    });
  });
}

export async function resetInternalQaTrainerAccount(trainerId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const convIds = await tx.trainerClientConversation.findMany({
      where: { trainerId },
      select: { id: true },
    });
    const ids = convIds.map((c) => c.id);
    if (ids.length) {
      await tx.internalQaDeferredOfficialChat.deleteMany({ where: { conversationId: { in: ids } } });
      await tx.trainerClientChatMessage.deleteMany({ where: { conversationId: { in: ids } } });
      await tx.trainerClientConversation.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.trainerClientNudge.deleteMany({ where: { trainerId } });
    await tx.trainerDiscoverMatchBatch.deleteMany({ where: { trainerId } });

    await tx.webPushSubscription.deleteMany({ where: { trainerId } });
    await tx.trainerTwoFactorChannel.deleteMany({ where: { trainerId } });

    await tx.trainerProfile.updateMany({
      where: { trainerId },
      data: {
        hasSignedTOS: false,
        hasUploadedW9: false,
        hasPaidBackgroundFee: false,
        backgroundCheckStatus: "NOT_STARTED",
        backgroundCheckReviewStatus: "NOT_STARTED",
        backgroundCheckClearedAt: null,
        certificationUrl: null,
        otherCertificationUrl: null,
        nutritionistCertificationUrl: null,
        specialistCertificationUrl: null,
        certificationReviewStatus: "NOT_STARTED",
        nutritionistCertificationReviewStatus: "NOT_STARTED",
        specialistCertificationReviewStatus: "NOT_STARTED",
        otherCertificationReviewStatus: "NOT_STARTED",
        onboardingTrackCpt: false,
        onboardingTrackNutrition: false,
        onboardingTrackSpecialist: false,
        specialistProfessionalRole: null,
        dashboardActivatedAt: null,
        matchQuestionnaireStatus: "not_started",
        matchQuestionnaireAnswers: null,
        matchQuestionnaireCompletedAt: null,
        aiMatchProfileText: null,
        followUpQuestionnaireAnswersJson: null,
        serviceOfferingsJson: null,
        premiumStudioEnabledAt: null,
        w9Json: null,
      },
    });

    await tx.trainer.update({
      where: { id: trainerId },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        bio: null,
        profileImageUrl: null,
        fitnessNiches: null,
        yearsCoaching: null,
        pronouns: null,
        ethnicity: null,
        languagesSpoken: null,
        genderIdentity: null,
        socialInstagram: null,
        socialTiktok: null,
        socialFacebook: null,
        socialLinkedin: null,
        socialOtherUrl: null,
      },
    });
  });
}
