import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { trainerMatchQuestionnaireSchema } from "@/lib/trainer-match-questionnaire";
import { TrainerMatchQuestionnaireClient } from "./trainer-match-questionnaire-client";

export const metadata: Metadata = {
  title: "Match Me (required) | Trainer | Match Fit",
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
      matchQuestionnaireAnswers: true,
      matchQuestionnaireCompletedAt: true,
    },
  });

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
  const parsed = parsedInput != null ? trainerMatchQuestionnaireSchema.safeParse(parsedInput) : null;
  const initialPayload = parsed?.success ? parsed.data : null;

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Match Me</h1>
          <span className="rounded-full border border-amber-400/45 bg-amber-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100">
            Required onboarding
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Required once (you can update anytime). We save structured answers plus a plain-text profile for client search
          and AI matching.
        </p>
      </div>

      <div className="mt-10">
        <TrainerMatchQuestionnaireClient
          initialPayload={initialPayload}
          status={status}
          completedAtIso={completedAtIso}
        />
      </div>
    </>
  );
}
