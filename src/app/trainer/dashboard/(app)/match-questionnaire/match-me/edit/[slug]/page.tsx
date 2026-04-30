import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TRAINER_MATCH_ME_PATH } from "@/lib/trainer-match-questionnaires-routes";
import { TrainerMatchQuestionnaireEditClient } from "../trainer-match-questionnaire-edit-client";
import { defaultTrainerMatchQuestionnaireDraft, parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import {
  MATCH_QUESTIONNAIRE_EDIT_SLUGS,
  type MatchQuestionnaireEditSlug,
  slugToStep,
} from "@/lib/trainer-match-questionnaire-section-meta";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const titleSlug = MATCH_QUESTIONNAIRE_EDIT_SLUGS.includes(slug as MatchQuestionnaireEditSlug) ? slug : "section";
  return {
    title: `Onboarding Questionnaire · ${titleSlug.replace(/-/g, " ")} | Trainer | Match Fit`,
  };
}

export default async function TrainerMatchQuestionnaireEditSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const { slug } = await params;
  if (slug === "services-pricing") {
    redirect(TRAINER_MATCH_ME_PATH);
  }
  if (!MATCH_QUESTIONNAIRE_EDIT_SLUGS.includes(slug as MatchQuestionnaireEditSlug)) {
    notFound();
  }
  const typedSlug = slug as MatchQuestionnaireEditSlug;
  const step = slugToStep(slug);
  if (!step) notFound();

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      matchQuestionnaireStatus: true,
      matchQuestionnaireAnswers: true,
      matchQuestionnaireCompletedAt: true,
    },
  });

  const draftSourceKey = profile?.matchQuestionnaireAnswers ?? "";

  const status = profile?.matchQuestionnaireStatus ?? "not_started";
  const completedAtIso = profile?.matchQuestionnaireCompletedAt?.toISOString() ?? null;

  let parsedInput: unknown = null;
  const raw = profile?.matchQuestionnaireAnswers;
  if (raw) {
    try {
      parsedInput = JSON.parse(raw) as unknown;
    } catch {
      parsedInput = null;
    }
  }

  const initialDraft = parsedInput != null ? parseTrainerMatchQuestionnaireDraft(parsedInput) : defaultTrainerMatchQuestionnaireDraft();

  return (
    <TrainerMatchQuestionnaireEditClient
      key={`${typedSlug}-${draftSourceKey}`}
      slug={typedSlug}
      step={step}
      initialDraft={initialDraft}
      status={status}
      completedAtIso={completedAtIso}
    />
  );
}
