import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TRAINER_QUESTIONNAIRES_CATALOG } from "@/lib/trainer-match-questionnaires-catalog";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Match questionnaires | Trainer | Match Fit",
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
    },
  });

  const matchMeCompleted = profile?.matchQuestionnaireStatus === "completed";
  const matchMeCompletedAtIso = profile?.matchQuestionnaireCompletedAt?.toISOString() ?? null;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]/90">Trainer</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">Match questionnaires</h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/50">
          Each link below is its own questionnaire. <span className="text-white/70">Match Me</span> is required for
          client visibility until it&apos;s fully complete; other surveys may appear over time.
        </p>
      </header>

      {matchMeCompleted ? (
        <p
          className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          Match Me is complete
          {matchMeCompletedAtIso
            ? ` (${new Date(matchMeCompletedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})`
            : ""}
          . You can still open it to update any section.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {TRAINER_QUESTIONNAIRES_CATALOG.map((q) =>
          q.href ? (
            <Link
              key={q.key}
              href={q.href}
              className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 px-5 py-5 text-left shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)] transition hover:border-[#FF7E00]/35"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-lg font-black tracking-tight text-white">{q.title}</span>
                {q.badge ? (
                  <span className="max-w-[11rem] shrink-0 rounded-full border border-amber-400/45 bg-amber-400/15 px-2 py-0.5 text-[8px] font-black uppercase leading-tight tracking-wide text-amber-100 sm:text-[9px]">
                    {q.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{q.summary}</p>
              <p className="mt-3 text-[11px] leading-snug text-white/45">{q.disclaimer}</p>
              <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#FF7E00]">Open questionnaire →</p>
            </Link>
          ) : (
            <div
              key={q.key}
              className="rounded-3xl border border-dashed border-white/[0.12] bg-[#0E1016]/50 px-5 py-5 text-left"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-lg font-black tracking-tight text-white/70">{q.title}</span>
                {q.badge ? (
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white/45 sm:text-[9px]">
                    {q.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{q.summary}</p>
              <p className="mt-3 text-[11px] leading-snug text-white/40">{q.disclaimer}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
