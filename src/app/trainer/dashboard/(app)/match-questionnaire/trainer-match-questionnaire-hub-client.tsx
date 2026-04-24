"use client";

import Link from "next/link";
import {
  FOLLOW_UP_SURVEYS_BLURB,
  MATCH_QUESTIONNAIRE_SECTIONS,
} from "@/lib/trainer-match-questionnaire-section-meta";

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
          Match Me is on file
          {props.completedAtIso
            ? ` (submitted ${new Date(props.completedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})`
            : ""}
          . Open any section below to edit; save from that page returns you to your dashboard.
        </p>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-sm text-white/55">
          Match Me is one questionnaire with several parts. Complete every part so your profile can appear to clients.
          Choose a section to edit—each has reminders that apply only to that part.
        </p>
      )}

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">Sections</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MATCH_QUESTIONNAIRE_SECTIONS.map((sec) => (
            <Link
              key={sec.slug}
              href={`/trainer/dashboard/match-questionnaire/edit/${sec.slug}`}
              className="rounded-3xl border border-white/[0.08] bg-[#12151C]/80 px-4 py-4 text-left transition hover:border-[#FF7E00]/35 hover:bg-[#12151C]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-sm font-black tracking-tight text-white">{sec.title}</span>
                {sec.requiredForClientVisibility ? (
                  <span className="shrink-0 rounded-full border border-amber-400/45 bg-amber-400/15 px-2 py-0.5 text-[8px] font-black uppercase leading-tight tracking-wide text-amber-100 sm:text-[9px]">
                    Required for client visibility
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-white/40">{sec.summary}</p>
              <p className="mt-3 text-[11px] leading-snug text-white/50">{sec.disclaimer}</p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#FF7E00]">Edit section →</p>
            </Link>
          ))}
          <div className="rounded-3xl border border-dashed border-white/[0.12] bg-[#0E1016]/40 px-4 py-4">
            <p className="text-sm font-black tracking-tight text-white/70">Follow-up questionnaires</p>
            <p className="mt-1 text-[11px] text-white/35">Optional · coming as we learn your profile</p>
            <p className="mt-3 text-[11px] leading-snug text-white/45">{FOLLOW_UP_SURVEYS_BLURB}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
