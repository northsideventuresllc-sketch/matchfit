import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TrainerPublicProfileView } from "@/components/trainer/trainer-public-profile-view";
import type { TrainerPublicSocialLink } from "@/components/trainer/trainer-public-profile-view";
import { parseAiMatchProfileForDisplay } from "@/lib/ai-match-profile-parse";
import { mapMatchProfileBlocksForPublicClientPage } from "@/lib/trainer-public-match-profile-display";
import {
  offeringDocumentToDisplayLines,
  parseTrainerServiceOfferingsJson,
  publicBrowseableSkuSummaries,
} from "@/lib/trainer-service-offerings";
import { parseTrainerOptionalProfileVisibility } from "@/lib/optional-profile-visibility";
import { getTrainerPublicReviewSummary } from "@/lib/client-trainer-reviews";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import {
  trainerOffersNutritionServices,
  trainerOffersPersonalTrainingServices,
} from "@/lib/trainer-service-buckets";

const PROFILE_CHECKOUT_COL = "clientsCanPurchaseServicesFromProfile";

const trainerPublicOuterSelect = {
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
  optionalProfileVisibilityJson: true,
  deidentifiedAt: true,
} as const;

const trainerPublicProfileSelect = {
  dashboardActivatedAt: true,
  hasSignedTOS: true,
  hasUploadedW9: true,
  backgroundCheckStatus: true,
  onboardingTrackCpt: true,
  onboardingTrackNutrition: true,
  onboardingTrackSpecialist: true,
  certificationReviewStatus: true,
  nutritionistCertificationReviewStatus: true,
  specialistCertificationReviewStatus: true,
  matchQuestionnaireStatus: true,
  aiMatchProfileText: true,
  serviceOfferingsJson: true,
  bookingAvailabilityJson: true,
  bookingTimezone: true,
} as const;

type Props = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ serviceCheckout?: string }>;
};

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
  if (trainerOffersPersonalTrainingServices(profile)) {
    out.push("Certified Personal Trainer");
  }
  if (trainerOffersNutritionServices(profile)) {
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
      deidentifiedAt: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
        },
      },
    },
  });
  const published =
    trainer?.profile?.dashboardActivatedAt != null &&
    !trainer.deidentifiedAt &&
    isTrainerComplianceComplete(trainer.profile);
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

export default async function TrainerPublicProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const handle = decodeURIComponent(username);
  const checkoutQuery = searchParams ? await searchParams : {};
  const checkoutNotice =
    checkoutQuery.serviceCheckout === "success"
      ? "success"
      : checkoutQuery.serviceCheckout === "canceled"
        ? "canceled"
        : null;

  let trainer;
  try {
    trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        ...trainerPublicOuterSelect,
        profile: {
          select: { ...trainerPublicProfileSelect, clientsCanPurchaseServicesFromProfile: true },
        },
      },
    });
  } catch (e) {
    if (isPrismaMissingColumnError(e, PROFILE_CHECKOUT_COL)) {
      trainer = await prisma.trainer.findUnique({
        where: { username: handle },
        select: {
          ...trainerPublicOuterSelect,
          profile: { select: { ...trainerPublicProfileSelect } },
        },
      });
    } else {
      throw e;
    }
  }

  if (!trainer?.profile || trainer.deidentifiedAt) {
    notFound();
  }

  const published =
    trainer.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(trainer.profile);
  if (!published) {
    notFound();
  }

  const vis = parseTrainerOptionalProfileVisibility(trainer.optionalProfileVisibilityJson);

  const blocks =
    trainer.profile.matchQuestionnaireStatus === "completed" && trainer.profile.aiMatchProfileText
      ? parseAiMatchProfileForDisplay(trainer.profile.aiMatchProfileText)
      : [];

  const offeringsDoc = parseTrainerServiceOfferingsJson(trainer.profile.serviceOfferingsJson);
  const fromOfferings = offeringDocumentToDisplayLines(offeringsDoc);
  const servicesBlock = blocks.find((b) => b.kind === "list" && b.title === "Services and Rates");
  const legacyRates = servicesBlock && servicesBlock.kind === "list" ? servicesBlock.items : null;
  const servicesRates =
    fromOfferings.length > 0 ? fromOfferings : legacyRates && legacyRates.length > 0 ? legacyRates : null;
  const profileCheckoutToggle =
    PROFILE_CHECKOUT_COL in trainer.profile
      ? trainer.profile.clientsCanPurchaseServicesFromProfile
      : undefined;
  const allowProfileCheckout = profileCheckoutToggle !== false;
  const browseableServices = fromOfferings.length > 0 ? publicBrowseableSkuSummaries(offeringsDoc) : null;

  const messagePath = `/client/messages/${encodeURIComponent(trainer.username)}`;

  const fullProfileUrl = await absoluteProfileUrl(trainer.username);

  const clientId = await getSessionClientId();
  const sessionTrainerId = await getSessionTrainerId();

  let officialChatStartedAt: Date | null = null;
  if (clientId) {
    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
      select: { officialChatStartedAt: true },
    });
    officialChatStartedAt = conv?.officialChatStartedAt ?? null;
  }

  let checkoutLinkContext: "profile" | "chat" | null = null;
  const disableClientActions = sessionTrainerId != null && sessionTrainerId === trainer.id;
  if (browseableServices && browseableServices.length > 0 && clientId && !disableClientActions && officialChatStartedAt) {
    checkoutLinkContext = allowProfileCheckout ? "profile" : "chat";
  }

  const coachBlocks = blocks.filter((b) => !(b.kind === "list" && b.title === "Services and Rates"));
  const { highlightBlocks, idealClientParagraph } = mapMatchProfileBlocksForPublicClientPage(
    coachBlocks,
    displayName(trainer),
  );

  const backToDashboardHref = clientId
    ? "/client/dashboard"
    : sessionTrainerId
      ? "/trainer/dashboard"
      : "/client";

  const reviewSummary = await getTrainerPublicReviewSummary(trainer.id);
  const showClientReviewPanel = Boolean(clientId) && !disableClientActions;

  return (
    <TrainerPublicProfileView
      displayName={displayName(trainer)}
      username={trainer.username}
      bio={trainer.bio}
      profileImageUrl={trainer.profileImageUrl}
      pronouns={vis.showPronouns ? trainer.pronouns : null}
      fitnessNiches={trainer.fitnessNiches}
      yearsCoaching={trainer.yearsCoaching}
      languagesSpoken={vis.showLanguagesSpoken ? trainer.languagesSpoken : null}
      genderIdentity={vis.showGenderIdentity ? trainer.genderIdentity : null}
      ethnicity={vis.showEthnicity ? trainer.ethnicity : null}
      certificationBadges={certificationBadges(trainer.profile)}
      socialLinks={socialLinks(trainer)}
      fullProfileUrl={fullProfileUrl}
      backToDashboardHref={backToDashboardHref}
      messageHref={messagePath}
      disableClientActions={disableClientActions}
      servicesRates={servicesRates}
      idealClientParagraph={idealClientParagraph}
      highlightBlocks={highlightBlocks}
      reviewSummary={reviewSummary}
      showClientReviewPanel={showClientReviewPanel}
      browseableServices={browseableServices}
      servicesCheckoutLinkContext={checkoutLinkContext}
      officialChatMatched={Boolean(officialChatStartedAt)}
      trainerAllowsProfileCheckout={allowProfileCheckout}
      clientIsSignedIn={Boolean(clientId)}
      checkoutNotice={checkoutNotice}
      showClientPrivacyMenu={Boolean(clientId) && !disableClientActions}
      availabilityHref={`/trainers/${encodeURIComponent(trainer.username)}/availability`}
    />
  );
}
