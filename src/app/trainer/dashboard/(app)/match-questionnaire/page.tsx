import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrainerMatchQuestionnaireHubClient } from "./trainer-match-questionnaire-hub-client";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Match Me | Trainer | Match Fit",
};

export default async function TrainerMatchQuestionnairePage() {
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Match Me</h1>
          <span
            className="max-w-[14rem] rounded-full border border-amber-400/45 bg-amber-400/15 px-2.5 py-1 text-[9px] font-black uppercase leading-tight tracking-wide text-amber-100 sm:max-w-none sm:text-[10px] sm:tracking-wider"
            title="Finish this questionnaire so your account can appear in client search and matching."
          >
            Required for client visibility
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          One questionnaire, several sections. Pick a section to edit—you&apos;ll open that part only. Saving returns
          you to your dashboard.
        </p>
      </div>

      <div className="mt-10">
        <TrainerMatchQuestionnaireHubClient status={status} completedAtIso={completedAtIso} />
      </div>
    </>
  );
}
