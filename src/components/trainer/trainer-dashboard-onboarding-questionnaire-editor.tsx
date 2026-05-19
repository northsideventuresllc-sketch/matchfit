"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CollapsibleSettingsSection } from "@/components/client/collapsible-settings-section";
import { TrainerMatchQuestionnaireStepFields } from "@/components/trainer/trainer-match-questionnaire-step-fields";
import { useTrainerMatchQuestionnaireDraftState } from "@/hooks/use-trainer-match-questionnaire-draft-state";
import type { TrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import { MATCH_QUESTIONNAIRE_SECTIONS } from "@/lib/trainer-match-questionnaire-section-meta";

type Props = {
  initialDraft: TrainerMatchQuestionnaireDraft;
  status: string;
  completedAtIso: string | null;
};

export function TrainerDashboardOnboardingQuestionnaireEditor(props: Props) {
  const router = useRouter();
  const draftState = useTrainerMatchQuestionnaireDraftState(props.initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<number | null>(null);

  const completed = props.status === "completed";

  async function saveStep(step: number): Promise<boolean> {
    const err = draftState.validateStep(step);
    if (err) {
      setError(err);
      setOk(null);
      return false;
    }
    setBusyStep(step);
    setError(null);
    setOk(null);
    try {
      const draft = draftState.serializeDraft();
      const res = await fetch("/api/trainer/dashboard/match-questionnaire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step, answers: draft }),
      });
      const data = (await res.json()) as { error?: string; completed?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return false;
      }
      draftState.commitBaseline();
      const section = MATCH_QUESTIONNAIRE_SECTIONS.find((s) => s.step === step);
      setOk(
        data.completed
          ? "Onboarding Questionnaire saved. Your profile is complete."
          : `${section?.title ?? "Section"} saved.`,
      );
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong.");
      return false;
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <div className="space-y-4 text-left">
      {completed ? (
        <p className="text-sm text-emerald-200/80">
          Onboarding Questionnaire on file
          {props.completedAtIso
            ? ` · ${new Date(props.completedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
            : ""}
          . Expand a section to edit; saving keeps you on this page.
        </p>
      ) : (
        <p className="text-sm text-white/55">
          Complete every section below so clients can discover you. Expand each part, update your answers, and save that
          section—your changes stay on this page.
        </p>
      )}

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <div className="space-y-4">
        {MATCH_QUESTIONNAIRE_SECTIONS.map((sec) => (
          <CollapsibleSettingsSection
            key={sec.slug}
            title={sec.title}
            description={sec.summary}
            defaultOpen={false}
          >
            <div className="space-y-6">
              <p className="text-[11px] leading-snug text-white/45">{sec.disclaimer}</p>
              <TrainerMatchQuestionnaireStepFields step={sec.step} state={draftState} />
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={busyStep != null}
                  onClick={() => void saveStep(sec.step)}
                  className="group relative isolate flex min-h-[2.75rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                  />
                  <span className="relative">
                    {busyStep === sec.step ? "Saving…" : `Save ${sec.title}`}
                  </span>
                </button>
              </div>
            </div>
          </CollapsibleSettingsSection>
        ))}
      </div>
    </div>
  );
}
