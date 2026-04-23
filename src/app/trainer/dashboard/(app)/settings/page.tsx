import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerSettingsPageClient } from "./trainer-settings-page-client";

export const metadata: Metadata = {
  title: "Account settings | Trainer | Match Fit",
};

export default async function TrainerAccountSettingsPage() {
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
      bio: true,
      profileImageUrl: true,
      email: true,
      phone: true,
      username: true,
      pronouns: true,
      ethnicity: true,
      languagesSpoken: true,
      fitnessNiches: true,
      yearsCoaching: true,
      genderIdentity: true,
      socialInstagram: true,
      socialTiktok: true,
      socialFacebook: true,
      socialLinkedin: true,
      socialOtherUrl: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      stayLoggedIn: true,
    },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }

  const twoFactorChannels = await prisma.trainerTwoFactorChannel.findMany({
    where: { trainerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      delivery: true,
      email: true,
      phone: true,
      verified: true,
      isDefaultLogin: true,
    },
  });

  const initialDefaultChannelId =
    twoFactorChannels.find((c) => c.isDefaultLogin)?.id ??
    twoFactorChannels.find((c) => c.verified)?.id ??
    null;

  const initialProfile = {
    firstName: trainer.firstName,
    lastName: trainer.lastName,
    preferredName: trainer.preferredName,
    bio: trainer.bio,
    profileImageUrl: trainer.profileImageUrl,
    email: trainer.email,
    phone: trainer.phone,
    username: trainer.username,
    pronouns: trainer.pronouns,
    ethnicity: trainer.ethnicity,
    languagesSpoken: trainer.languagesSpoken,
    fitnessNiches: trainer.fitnessNiches,
    yearsCoaching: trainer.yearsCoaching,
    genderIdentity: trainer.genderIdentity,
    socialInstagram: trainer.socialInstagram,
    socialTiktok: trainer.socialTiktok,
    socialFacebook: trainer.socialFacebook,
    socialLinkedin: trainer.socialLinkedin,
    socialOtherUrl: trainer.socialOtherUrl,
  };

  return (
    <TrainerSettingsPageClient
      initialProfile={initialProfile}
      initialStayLoggedIn={trainer.stayLoggedIn}
      twoFactorEnabled={trainer.twoFactorEnabled}
      twoFactorMethod={trainer.twoFactorMethod}
      twoFactorChannels={twoFactorChannels}
      initialDefaultChannelId={initialDefaultChannelId}
    />
  );
}
