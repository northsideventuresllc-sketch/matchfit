import { randomBytes } from "crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import { getStripe } from "@/lib/stripe-server";

function tombstoneUsername(prefix: string): string {
  const suffix = randomBytes(5).toString("hex");
  return `${prefix}_${suffix}`.slice(0, 32);
}

function tombstoneEmail(kind: "client" | "trainer", id: string): string {
  const tail = id.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "user";
  return `removed.${kind}.${tail}.${randomBytes(4).toString("hex")}@account-removed.invalid`.toLowerCase();
}

async function cancelClientStripeSubscriptions(
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
) {
  const stripe = getStripe();
  if (!stripe) return;
  if (stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch {
      /* already canceled / missing */
    }
  }
  if (stripeCustomerId) {
    try {
      await stripe.customers.del(stripeCustomerId);
    } catch {
      /* may fail if still referenced */
    }
  }
}

/**
 * Irreversibly scrub PII on a client account. Safe for Node scripts (pass any PrismaClient).
 */
export async function deidentifyClientAccountWithDb(db: PrismaClient, clientId: string): Promise<boolean> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!client) return false;

  await cancelClientStripeSubscriptions(client.stripeCustomerId, client.stripeSubscriptionId);

  const deadHash = await hashPassword(randomBytes(32).toString("hex"));
  const newUsername = tombstoneUsername("delc");
  const newEmail = tombstoneEmail("client", clientId);

  await db.$transaction(async (tx) => {
    await tx.clientTwoFactorChannel.deleteMany({ where: { clientId } });
    await tx.webPushSubscription.deleteMany({ where: { clientId } });

    const convIds = await tx.trainerClientConversation.findMany({
      where: { clientId },
      select: { id: true },
    });
    if (convIds.length > 0) {
      await tx.trainerClientChatMessage.updateMany({
        where: { authorRole: "CLIENT", conversationId: { in: convIds.map((c) => c.id) } },
        data: { body: "[This message was removed when the account was deleted.]" },
      });
    }

    await tx.client.update({
      where: { id: clientId },
      data: {
        deidentifiedAt: new Date(),
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
        firstName: "Former",
        lastName: "Member",
        preferredName: "Former member",
        username: newUsername,
        email: newEmail,
        phone: "",
        passwordHash: deadHash,
        zipCode: "00000",
        dateOfBirth: "1970-01-01",
        bio: null,
        profileImageUrl: null,
        addressLine1: null,
        addressLine2: null,
        addressCity: null,
        addressState: null,
        addressPostal: null,
        addressCountry: null,
        pendingEmail: null,
        emailChangeNonce: null,
        emailChangeExpires: null,
        pendingPhone: null,
        phoneChangeOtpHash: null,
        phoneChangeOtpExpires: null,
        passwordChangeNonce: null,
        passwordChangeExpires: null,
        passwordChangeOtpHash: null,
        passwordChangeOtpExpires: null,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionActive: false,
        stripeBillingLiveMode: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        matchPreferencesJson: null,
        matchPreferencesCompletedAt: null,
        allowTrainerDiscovery: false,
        notificationPrefsJson: null,
        fitHubPrefsJson: null,
        dailyAlgorithmContextJson: null,
        optionalProfileVisibilityJson: null,
      },
    });
  });

  return true;
}

/** Irreversibly scrub PII on a trainer account. Safe for Node scripts (pass any PrismaClient). */
export async function deidentifyTrainerAccountWithDb(db: PrismaClient, trainerId: string): Promise<boolean> {
  const trainer = await db.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true },
  });
  if (!trainer) return false;

  const deadHash = await hashPassword(randomBytes(32).toString("hex"));
  const newUsername = tombstoneUsername("delt");
  const newEmail = tombstoneEmail("trainer", trainerId);

  await db.$transaction(async (tx) => {
    await tx.trainerTwoFactorChannel.deleteMany({ where: { trainerId } });
    await tx.webPushSubscription.deleteMany({ where: { trainerId } });

    const convIds = await tx.trainerClientConversation.findMany({
      where: { trainerId },
      select: { id: true },
    });
    if (convIds.length > 0) {
      await tx.trainerClientChatMessage.updateMany({
        where: { authorRole: "TRAINER", conversationId: { in: convIds.map((c) => c.id) } },
        data: { body: "[This message was removed when the account was deleted.]" },
      });
    }

    await tx.trainerFitHubPost.updateMany({
      where: { trainerId },
      data: {
        visibility: "PRIVATE",
        caption: null,
        bodyText: null,
        mediaUrl: null,
        mediaUrlsJson: null,
        hashtagsJson: null,
      },
    });

    await tx.trainerProfile.updateMany({
      where: { trainerId },
      data: {
        w9Json: null,
        w9SelfServeEmailOtpHash: null,
        w9SelfServeEmailOtpExpires: null,
        aiMatchProfileText: null,
        matchQuestionnaireAnswers: null,
        followUpQuestionnaireAnswersJson: null,
        certificationUrl: null,
        otherCertificationUrl: null,
        nutritionistCertificationUrl: null,
        specialistCertificationUrl: null,
        serviceOfferingsJson: null,
        fitHubStudioActivityReadKeysJson: null,
      },
    });

    await tx.trainer.update({
      where: { id: trainerId },
      data: {
        deidentifiedAt: new Date(),
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
        firstName: "Former",
        lastName: "Coach",
        preferredName: "Former coach",
        username: newUsername,
        email: newEmail,
        phone: "",
        passwordHash: deadHash,
        bio: null,
        pronouns: null,
        ethnicity: null,
        languagesSpoken: null,
        fitnessNiches: null,
        yearsCoaching: null,
        genderIdentity: null,
        profileImageUrl: null,
        socialInstagram: null,
        socialTiktok: null,
        socialFacebook: null,
        socialLinkedin: null,
        socialOtherUrl: null,
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        passwordChangeNonce: null,
        passwordChangeExpires: null,
        passwordChangeOtpHash: null,
        passwordChangeOtpExpires: null,
        notificationPrefsJson: null,
        optionalProfileVisibilityJson: null,
      },
    });
  });

  return true;
}
