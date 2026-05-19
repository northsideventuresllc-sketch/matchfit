"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { TrainerMatchQuestionnaireStepFields } from "@/components/trainer/trainer-match-questionnaire-step-fields";
import { useTrainerMatchQuestionnaireDraftState } from "@/hooks/use-trainer-match-questionnaire-draft-state";
import type { TrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import type { MatchQuestionnaireEditSlug } from "@/lib/trainer-match-questionnaire-section-meta";
import { MATCH_QUESTIONNAIRE_SECTIONS } from "@/lib/trainer-match-questionnaire-section-meta";
import { TRAINER_MATCH_ME_PATH, TRAINER_MATCH_QUESTIONNAIRES_PATH } from "@/lib/trainer-match-questionnaires-routes";

type Props = {
  slug: MatchQuestionnaireEditSlug;
  step: 1 | 2 | 3 | 4;
  initialDraft: TrainerMatchQuestionnaireDraft;
  status: string;
  completedAtIso: string | null;
};

export function TrainerMatchQuestionnaireEditClient(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const section = MATCH_QUESTIONNAIRE_SECTIONS.find((s) => s.slug === props.slug)!;
  const draftState = useTrainerMatchQuestionnaireDraftState(props.initialDraft);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveModal, setLeaveModal] = useState<{ href: string } | null>(null);

  const completed = props.status === "completed";
  const { isDirty } = draftState;

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    function onClickCapture(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveModal({ href: url.pathname + url.search + url.hash });
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isDirty, pathname]);

  async function saveDraft(): Promise<boolean> {
    const err = draftState.validateStep(props.step);
    if (err) {
      setError(err);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const draft = draftState.serializeDraft();
      const res = await fetch("/api/trainer/dashboard/match-questionnaire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step: props.step, answers: draft }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return false;
      }
      draftState.commitBaseline();
      return true;
    } catch {
      setError("Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await saveDraft();
    if (ok) router.push(TRAINER_MATCH_QUESTIONNAIRES_PATH);
  }

  async function handleLeaveSave() {
    const ok = await saveDraft();
    if (!ok) return;
    const href = leaveModal?.href;
    setLeaveModal(null);
    if (href) router.push(href);
  }

  function handleLeaveDiscard() {
    const href = leaveModal?.href;
    setLeaveModal(null);
    if (href) router.push(href);
  }

  function guardedLeave(e: React.MouseEvent, href: string) {
    if (!isDirty) return;
    e.preventDefault();
    setLeaveModal({ href });
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <Link
          href={TRAINER_MATCH_QUESTIONNAIRES_PATH}
          onClick={(e) => guardedLeave(e, TRAINER_MATCH_QUESTIONNAIRES_PATH)}
          className="text-xs font-medium text-white/45 transition hover:text-white/70"
        >
          ← Daily Questionnaires
        </Link>
        <Link
          href={TRAINER_MATCH_ME_PATH}
          onClick={(e) => guardedLeave(e, TRAINER_MATCH_ME_PATH)}
          className="text-xs font-medium text-white/45 transition hover:text-white/70"
        >
          ← Questionnaire Sections
        </Link>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{section.title}</h1>
        </div>
        <p className="text-[11px] leading-snug text-white/50">{section.disclaimer}</p>
        {completed ? (
          <p className="text-xs text-emerald-200/80">
            Onboarding Questionnaire on file
            {props.completedAtIso
              ? ` · ${new Date(props.completedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : ""}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error ? (
          <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <TrainerMatchQuestionnaireStepFields step={props.step} state={draftState} sectionTitle={section.title} />
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={TRAINER_MATCH_ME_PATH}
            onClick={(e) => guardedLeave(e, TRAINER_MATCH_ME_PATH)}
            className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-wide text-white transition hover:border-white/25"
          >
            Back
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate min-h-[3rem] flex-1 overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-wide text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">
              {busy ? "Saving…" : completed ? "Update Questionnaire" : "Save Questionnaire"}
            </span>
          </button>
        </div>
      </form>

      {leaveModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-match-title"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#12151C] p-6 shadow-2xl">
            <h2 id="leave-match-title" className="text-lg font-black uppercase tracking-wide text-white">
              Unsaved changes
            </h2>
            <p className="mt-3 text-xs font-semibold uppercase leading-relaxed tracking-wide text-white/55 sm:text-sm">
              Save this section before leaving, or discard changes and continue. Cancel stays on this page.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLeaveSave()}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#FF7E00]/25 disabled:opacity-50 sm:text-sm"
              >
                Save & continue
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLeaveDiscard}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-white/25 disabled:opacity-50 sm:text-sm"
              >
                Don&apos;t save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setLeaveModal(null)}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/10 px-4 text-xs font-black uppercase tracking-wide text-white/55 transition hover:text-white/80 disabled:opacity-50 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
