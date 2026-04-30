"use client";

import Link from "next/link";
import { MATCH_QUESTIONNAIRE_SECTIONS } from "@/lib/trainer-match-questionnaire-section-meta";
import { matchMeSectionEditHref } from "@/lib/trainer-match-questionnaires-routes";

type Props = {
  status: string;
  completedAtIso: string | null;
};

export function TrainerMatchQuestionnaireHubClient(props: Props) {
  const completed = props.status === "completed";

  return (
    <div className="space-y-8">
      {completed ? (
        <p
          className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          Onboarding Questionnaire is on file
          {props.completedAtIso
            ? ` (submitted ${new Date(props.completedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})`
            : ""}
          . Open any section below to edit; save from that page returns you to your dashboard.
        </p>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-sm text-white/55">
          This is one questionnaire with several parts. Complete every part so your profile can appear to clients.
          Choose a section to edit—each has reminders that apply only to that part.
        </p>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold text-white/40">Sections</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MATCH_QUESTIONNAIRE_SECTIONS.map((sec) => (
            <Link
              key={sec.slug}
              href={matchMeSectionEditHref(sec.slug)}
              className="rounded-3xl border border-white/[0.08] bg-[#12151C]/80 px-4 py-4 text-left transition hover:border-[#FF7E00]/35 hover:bg-[#12151C]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-sm font-semibold tracking-tight text-white">{sec.title}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/40">{sec.summary}</p>
              <p className="mt-3 text-[11px] leading-snug text-white/50">{sec.disclaimer}</p>
              <p className="mt-3 text-xs font-semibold text-[#FF7E00]">Edit section →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
