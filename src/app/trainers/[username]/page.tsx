import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TrainerPublicProfileView } from "@/components/trainer/trainer-public-profile-view";
import type { TrainerPublicSocialLink } from "@/components/trainer/trainer-public-profile-view";
import { parseAiMatchProfileForDisplay } from "@/lib/ai-match-profile-parse";
import { mapMatchProfileBlocksForPublicClientPage } from "@/lib/trainer-public-match-profile-display";
import { prisma } from "@/lib/prisma";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";

type Props = { params: Promise<{ username: string }> };

function displayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

function certificationBadges(profile: {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
}): string[] {
  const out: string[] = [];
  if (profile.onboardingTrackCpt && profile.certificationReviewStatus === "APPROVED") {
    out.push("Certified Personal Trainer");
  }
  if (profile.onboardingTrackNutrition && profile.nutritionistCertificationReviewStatus === "APPROVED") {
    out.push("Nutrition credential");
  }
  return out;
}

function socialLinks(trainer: {
  socialInstagram: string | null;
  socialTiktok: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialOtherUrl: string | null;
}): TrainerPublicSocialLink[] {
  const rows: TrainerPublicSocialLink[] = [];
  if (trainer.socialInstagram?.trim()) {
    rows.push({ platform: "instagram", url: trainer.socialInstagram.trim(), label: "Instagram" });
  }
  if (trainer.socialTiktok?.trim()) {
    rows.push({ platform: "tiktok", url: trainer.socialTiktok.trim(), label: "TikTok" });
  }
  if (trainer.socialFacebook?.trim()) {
    rows.push({ platform: "facebook", url: trainer.socialFacebook.trim(), label: "Facebook" });
  }
  if (trainer.socialLinkedin?.trim()) {
    rows.push({ platform: "linkedin", url: trainer.socialLinkedin.trim(), label: "LinkedIn" });
  }
  if (trainer.socialOtherUrl?.trim()) {
    rows.push({ platform: "other", url: trainer.socialOtherUrl.trim(), label: "Website" });
  }
  return rows;
}

async function absoluteProfileUrl(username: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : "";
  return `${base}/trainers/${encodeURIComponent(username)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username);
  const trainer = await prisma.trainer.findUnique({
    where: { username: handle },
    select: {
      preferredName: true,
      firstName: true,
      lastName: true,
      bio: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
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
  const published =
    trainer?.profile?.dashboardActivatedAt != null && isTrainerComplianceComplete(trainer.profile);
  if (!trainer || !published) {
    return {
      title: `Coach | Match Fit`,
      description: "Find certified coaches on Match Fit.",
    };
  }
  const name = displayName(trainer);
  const description =
    trainer.bio?.trim().slice(0, 155) || `${name} is a verified Match Fit Coach. View services, rates, and book a session.`;
  return {
    title: `${name} (@${handle}) | Match Fit`,
    description,
    openGraph: {
      title: `${name} (@${handle})`,
      description,
      type: "profile",
    },
  };
}

export default async function TrainerPublicProfilePage({ params }: Props) {
  const { username } = await params;
  const handle = decodeURIComponent(username);

  const trainer = await prisma.trainer.findUnique({
    where: { username: handle },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      bio: true,
      pronouns: true,
      ethnicity: true,
      languagesSpoken: true,
      fitnessNiches: true,
      yearsCoaching: true,
      genderIdentity: true,
      profileImageUrl: true,
      socialInstagram: true,
      socialTiktok: true,
      socialFacebook: true,
      socialLinkedin: true,
      socialOtherUrl: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          matchQuestionnaireStatus: true,
          aiMatchProfileText: true,
        },
      },
    },
  });

  if (!trainer?.profile) {
    notFound();
  }

  const published =
    trainer.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(trainer.profile);
  if (!published) {
    notFound();
  }

  const blocks =
    trainer.profile.matchQuestionnaireStatus === "completed" && trainer.profile.aiMatchProfileText
      ? parseAiMatchProfileForDisplay(trainer.profile.aiMatchProfileText)
      : [];

  const servicesBlock = blocks.find((b) => b.kind === "list" && b.title === "Services and Rates");
  const servicesRates = servicesBlock && servicesBlock.kind === "list" ? servicesBlock.items : null;
  const coachBlocks = blocks.filter((b) => !(b.kind === "list" && b.title === "Services and Rates"));
  const { highlightBlocks, idealClientParagraph } = mapMatchProfileBlocksForPublicClientPage(
    coachBlocks,
    displayName(trainer),
  );

  const messagePath = `/client/messages/${encodeURIComponent(trainer.username)}`;

  const fullProfileUrl = await absoluteProfileUrl(trainer.username);

  const clientId = await getSessionClientId();
  const sessionTrainerId = await getSessionTrainerId();
  const backToDashboardHref = clientId
    ? "/client/dashboard"
    : sessionTrainerId
      ? "/trainer/dashboard"
      : "/client";

  return (
    <TrainerPublicProfileView
      displayName={displayName(trainer)}
      username={trainer.username}
      bio={trainer.bio}
      profileImageUrl={trainer.profileImageUrl}
      pronouns={trainer.pronouns}
      fitnessNiches={trainer.fitnessNiches}
      yearsCoaching={trainer.yearsCoaching}
      languagesSpoken={trainer.languagesSpoken}
      genderIdentity={trainer.genderIdentity}
      ethnicity={trainer.ethnicity}
      certificationBadges={certificationBadges(trainer.profile)}
      socialLinks={socialLinks(trainer)}
      fullProfileUrl={fullProfileUrl}
      backToDashboardHref={backToDashboardHref}
      messageHref={messagePath}
      servicesRates={servicesRates}
      idealClientParagraph={idealClientParagraph}
      highlightBlocks={highlightBlocks}
    />
  );
}
