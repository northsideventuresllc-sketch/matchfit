"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QuestionnaireCard = {
  key: string;
  title: string;
  href: string | null;
  summary: string;
  disclaimer: string;
  badge: string | null;
  completedAtIso: string | null;
  canDelete: boolean;
};

type Props = {
  incomplete: QuestionnaireCard[];
  completed: QuestionnaireCard[];
};

export function TrainerMatchQuestionnairesOverviewClient(props: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(card: QuestionnaireCard) {
    if (!card.canDelete || busyKey) return;
    const ok = window.confirm(
      "Delete this questionnaire's answers?\n\nThis will remove its data from trainer-client matching signals immediately. This action cannot be undone.",
    );
    if (!ok) return;

    setError(null);
    setBusyKey(card.key);
    try {
      const res = await fetch(
        `/api/trainer/dashboard/match-questionnaire/optional/${encodeURIComponent(card.key)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete questionnaire answers.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while deleting.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="mx-auto max-w-3xl rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Incomplete Questionnaires</h2>
        <div className="space-y-4">
          {props.incomplete.map((q) =>
            q.href ? (
              <Link
                key={q.key}
                href={q.href}
                className="mx-auto block w-full max-w-3xl rounded-3xl border border-white/[0.08] bg-[#12151C]/90 px-6 py-7 text-center shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)] transition hover:border-[#FF7E00]/35"
              >
                <div className="flex flex-col items-center justify-center gap-2">
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
                className="mx-auto w-full max-w-3xl rounded-3xl border border-dashed border-white/[0.12] bg-[#0E1016]/50 px-6 py-7 text-center"
              >
                <div className="flex flex-col items-center justify-center gap-2">
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
      </section>

      <section className="space-y-4">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Completed Questionnaires</h2>
        {props.completed.length === 0 ? (
          <p className="mx-auto max-w-3xl rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-4 text-center text-sm text-white/45">
            No completed Questionnaires yet.
          </p>
        ) : (
          <div className="space-y-4">
            {props.completed.map((q) => (
              <div key={q.key} className="mx-auto w-full max-w-3xl rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-7 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-lg font-black tracking-tight text-white">{q.title}</span>
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-300/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-100 sm:text-[9px]">
                    Completed
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{q.summary}</p>
                <p className="mt-2 text-[11px] text-white/65">
                  Completed{" "}
                  {q.completedAtIso
                    ? new Date(q.completedAtIso).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "recently"}
                </p>
                <div className="mt-4">
                  {q.href ? (
                    <Link href={q.href} className="text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                      Reopen Onboarding Questionnaire
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3">
                  {q.canDelete ? (
                    <button
                      type="button"
                      disabled={busyKey === q.key}
                      onClick={() => void handleDelete(q)}
                      className="text-xs font-semibold text-[#FFB4B4] underline-offset-2 transition hover:underline disabled:opacity-50"
                    >
                      {busyKey === q.key ? "Deleting…" : "Delete answers"}
                    </button>
                  ) : (
                    <p className="text-[11px] text-white/55">Mandatory questionnaire — answers cannot be deleted.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
