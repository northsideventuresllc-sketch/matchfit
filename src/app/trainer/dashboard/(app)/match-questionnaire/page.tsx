import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrainerMatchQuestionnairesOverviewClient } from "./trainer-match-questionnaires-overview-client";
import { TRAINER_QUESTIONNAIRES_CATALOG } from "@/lib/trainer-match-questionnaires-catalog";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Daily Questionnaires | Trainer | Match Fit",
};

export default async function TrainerMatchQuestionnairesOverviewPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      matchQuestionnaireStatus: true,
      matchQuestionnaireCompletedAt: true,
      followUpQuestionnaireAnswersJson: true,
    },
  });

  const matchMeCompleted = profile?.matchQuestionnaireStatus === "completed";
  const matchMeCompletedAtIso = profile?.matchQuestionnaireCompletedAt?.toISOString() ?? null;

  type OptionalAnswer = {
    key: string;
    title: string;
    summary: string;
    disclaimer: string;
    completedAtIso: string;
  };
  let optionalAnswers: OptionalAnswer[] = [];
  if (profile?.followUpQuestionnaireAnswersJson?.trim()) {
    try {
      const raw = JSON.parse(profile.followUpQuestionnaireAnswersJson) as unknown;
      if (Array.isArray(raw)) {
        optionalAnswers = raw
          .map((x) => (typeof x === "object" && x ? (x as OptionalAnswer) : null))
          .filter((x): x is OptionalAnswer => Boolean(x && typeof x.key === "string"))
          .map((x) => ({
            key: x.key,
            title: x.title,
            summary: x.summary,
            disclaimer: x.disclaimer,
            completedAtIso: x.completedAtIso,
          }));
      }
    } catch {
      optionalAnswers = [];
    }
  }

  const matchMeCatalog = TRAINER_QUESTIONNAIRES_CATALOG.find((q) => q.key === "match-me");
  const followUpCatalog = TRAINER_QUESTIONNAIRES_CATALOG.find((q) => q.key === "follow-up");

  const incomplete = [
    ...(matchMeCatalog && !matchMeCompleted
      ? [
          {
            ...matchMeCatalog,
            badge: matchMeCatalog.badge,
            completedAtIso: null as string | null,
            canDelete: false,
          },
        ]
      : []),
    ...(followUpCatalog
      ? [
          {
            ...followUpCatalog,
            completedAtIso: null as string | null,
            canDelete: false,
          },
        ]
      : []),
  ];

  const completed = [
    ...(matchMeCatalog && matchMeCompleted
      ? [
          {
            ...matchMeCatalog,
            badge: null,
            completedAtIso: matchMeCompletedAtIso,
            canDelete: false,
          },
        ]
      : []),
    ...optionalAnswers.map((x) => ({
      key: x.key,
      title: x.title,
      href: null,
      summary: x.summary,
      disclaimer: x.disclaimer,
      badge: null,
      completedAtIso: x.completedAtIso,
      canDelete: true,
    })),
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]/90">Trainer</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">Daily Questionnaires</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Each link below is its own questionnaire. The{" "}
          <span className="text-white/70">Onboarding Questionnaire</span> controls client visibility: until every part is
          finished, you will not be shown to clients. More questionnaires will appear over time so we can match you more
          accurately and send nudges that are more likely to become real clients.
        </p>
      </header>

      <TrainerMatchQuestionnairesOverviewClient incomplete={incomplete} completed={completed} />
    </div>
  );
}
