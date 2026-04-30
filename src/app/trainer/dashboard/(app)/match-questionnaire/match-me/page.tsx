import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerMatchQuestionnaireHubClient } from "../trainer-match-questionnaire-hub-client";
import { TRAINER_MATCH_QUESTIONNAIRES_PATH } from "@/lib/trainer-match-questionnaires-routes";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Onboarding Questionnaire | Trainer | Match Fit",
};

export default async function TrainerMatchMeQuestionnairePage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      matchQuestionnaireStatus: true,
      matchQuestionnaireCompletedAt: true,
    },
  });

  const status = profile?.matchQuestionnaireStatus ?? "not_started";
  const completedAtIso = profile?.matchQuestionnaireCompletedAt?.toISOString() ?? null;

  return (
    <>
      <div className="mb-6">
        <Link
          href={TRAINER_MATCH_QUESTIONNAIRES_PATH}
          className="text-xs font-medium text-white/45 transition hover:text-white/70"
        >
          ← Daily questionnaires
        </Link>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Onboarding Questionnaire</h1>
          <span
            className="max-w-[16rem] rounded-full border border-amber-400/45 bg-amber-400/15 px-3 py-1.5 text-[10px] font-black uppercase leading-snug tracking-wide text-amber-100 sm:max-w-none sm:text-xs"
            title="Finish every section so your account can appear in client search and matching."
          >
            REQUIRED FOR CLIENT VISIBILITY
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          One questionnaire, several sections. Pick a section to edit—saving returns you to your dashboard.
        </p>
      </div>

      <div className="mt-10">
        <TrainerMatchQuestionnaireHubClient status={status} completedAtIso={completedAtIso} />
      </div>
    </>
  );
}
