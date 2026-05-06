"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DailyFreeTextQuestion,
  DailyInterestPickQuestion,
  DailyQuestionnaireHistoryEntry,
  DailyQuestionnaireQuestions,
  DailyTrainerInterestQuestion,
} from "@/lib/client-daily-questionnaire";

type ActivePayload = {
  state: "active";
  serverNow: string;
  questionnaire: { id: string; questions: DailyQuestionnaireQuestions; completedAt: string | null };
  history: DailyQuestionnaireHistoryEntry[];
};

type CooldownPayload = {
  state: "cooldown";
  serverNow: string;
  nextAvailableAt: string;
  history: DailyQuestionnaireHistoryEntry[];
};

function titleCaseAnswerLabel(input: string): string {
  return input.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function ClientDailyQuestionnaireClient() {
  const router = useRouter();
  const [data, setData] = useState<ActivePayload | CooldownPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const lastQuestionnaireId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/daily-questionnaire");
      const json = (await res.json()) as ActivePayload | CooldownPayload | { error?: string };
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Could not load questionnaire.");
        setData(null);
        return;
      }
      const payload = json as ActivePayload | CooldownPayload;
      const history = Array.isArray(payload.history) ? payload.history : [];
      setData({ ...payload, history });
      if (payload.state === "active") {
        const qid = payload.questionnaire.id;
        if (lastQuestionnaireId.current !== qid) {
          lastQuestionnaireId.current = qid;
          const init: Record<string, string> = {};
          for (const q of payload.questionnaire.questions.questions) {
            if (q.kind === "trainer_interest_scale") init[q.id] = "3";
          }
          setAnswers(init);
          setCurrentStep(0);
        }
      }
    } catch {
      setError("Network error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const active = data?.state === "active" ? data : null;
  const questionList = active?.questionnaire.questions.questions ?? [];
  const totalSteps = questionList.length;
  const stepIndex = Math.max(0, Math.min(currentStep, Math.max(0, totalSteps - 1)));
  const currentQuestion = questionList[stepIndex] ?? null;
  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] ?? "") : "";
  const canMoveNext = currentQuestion ? currentAnswer.trim().length > 0 : false;

  const cooldownLabel = useMemo(() => {
    if (data?.state !== "cooldown") return "";
    const t = new Date(data.nextAvailableAt).getTime();
    return new Date(t).toLocaleString();
  }, [data]);

  async function submit() {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/client/daily-questionnaire/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId: active.questionnaire.id,
          answers,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-sm text-white/45">Loading your daily questionnaire…</p>;
  }

  if (error && !data) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  if (data?.state === "cooldown") {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white/85">You are all set for now.</p>
          <p className="mt-2 text-sm text-white/50">
            Your next individualized questionnaire unlocks after the 24-hour window. Next available:{" "}
            <span className="text-white/80">{cooldownLabel}</span>
          </p>
          <p className="mt-6 text-xs text-white/40">
            Answers you already submitted are saved to your account for matching.
          </p>
        </div>
        <QuestionnaireHistoryPanel entries={data.history} />
      </div>
    );
  }

  if (!active?.questionnaire) {
    return null;
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-emerald-100">
          THANK YOU — YOUR RESPONSES WERE SAVED.
        </p>
        <p className="mt-2 text-sm text-white/55">
          We combine these signals with your match preferences to surface better coach introductions over time.
        </p>
        <Link
          href="/client/dashboard"
          className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-center text-xs text-white/45">{active.questionnaire.questions.context.summaryLine}</p>
      <p className="text-center text-[11px] text-white/35">
        Open questionnaires that are not submitted within 72 hours are replaced automatically.
      </p>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF7E00]/90">
            Question {stepIndex + 1} of {totalSteps}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
            {Math.round(((stepIndex + 1) / Math.max(totalSteps, 1)) * 100)}% complete
          </p>
        </div>

        {currentQuestion?.kind === "trainer_interest_scale" ? (
          <TrainerInterestBlock
            q={currentQuestion}
            value={answers[currentQuestion.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [currentQuestion.id]: v }))}
          />
        ) : null}
        {currentQuestion?.kind === "single_choice" ? (
          <InterestPickBlock
            q={currentQuestion}
            value={answers[currentQuestion.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [currentQuestion.id]: v }))}
          />
        ) : null}
        {currentQuestion?.kind === "free_text" ? (
          <FreeTextBlock
            q={currentQuestion}
            value={answers[currentQuestion.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [currentQuestion.id]: v }))}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          className="min-h-[3rem] min-w-[8rem] rounded-xl border border-white/20 bg-white/[0.03] px-4 text-sm font-bold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
        >
          Back
        </button>

        {stepIndex < totalSteps - 1 ? (
          <button
            type="button"
            disabled={!canMoveNext}
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="group relative isolate flex min-h-[3rem] min-w-[10rem] items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">Next Question</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || !canMoveNext}
            onClick={() => void submit()}
            className="group relative isolate flex min-h-[3rem] min-w-[10rem] items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">{submitting ? "Saving…" : "Submit Answers"}</span>
          </button>
        )}
      </div>

      <QuestionnaireHistoryPanel entries={active.history} />
    </div>
  );
}

function formatHistoryAnswer(
  q: DailyTrainerInterestQuestion | DailyInterestPickQuestion | DailyFreeTextQuestion,
  raw: string,
): string {
  const v = raw?.trim() ?? "";
  if (!v) return "—";
  if (q.kind === "trainer_interest_scale") {
    return `${v} / ${q.scaleMax} (${q.lowLabel} → ${q.highLabel})`;
  }
  if (q.kind === "single_choice") {
    const opt = q.options.find((o) => o.value === v);
    return opt ? titleCaseAnswerLabel(opt.label) : v;
  }
  return v;
}

function QuestionnaireHistoryPanel(props: { entries: DailyQuestionnaireHistoryEntry[] }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0B0D12]/80 p-6 shadow-[0_28px_90px_-40px_rgba(0,0,0,0.75)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(255,126,0,0.12),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF7E00]/35 to-transparent"
      />
      <div className="relative text-center">
        <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">Past questionnaires</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/50">
          Revisit what you shared—helpful context as your goals evolve.
        </p>
      </div>
      {props.entries.length === 0 ? (
        <div className="relative mt-8 rounded-2xl border border-dashed border-white/[0.12] bg-gradient-to-b from-white/[0.04] to-transparent px-6 py-10 text-center">
          <p className="text-sm text-white/55">
            When you finish a daily questionnaire, it appears here so you can look back anytime.
          </p>
        </div>
      ) : (
        <ul className="relative mt-8 space-y-3">
          {props.entries.map((entry) => (
            <li
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-[#FF7E00]/25 hover:shadow-[0_12px_40px_-20px_rgba(255,126,0,0.15)]"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF7E00]/90">Completed</p>
                    <p className="mt-1 text-sm font-medium text-white/90">
                      {new Date(entry.completedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition group-open:rotate-180"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-current" aria-hidden>
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-white/[0.06] px-5 pb-5 pt-4">
                  {entry.questions.questions.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-white/[0.05] bg-[#07080C]/40 px-4 py-3.5 backdrop-blur-sm"
                    >
                      <p className="text-xs font-medium leading-snug text-white/70">{q.prompt}</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/85">{formatHistoryAnswer(q, entry.answers[q.id] ?? "")}</p>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrainerInterestBlock(props: {
  q: DailyTrainerInterestQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const { q } = props;
  const scale = [];
  for (let i = q.scaleMin; i <= q.scaleMax; i++) scale.push(i);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-semibold text-white/90">{q.prompt}</p>
      <div className="rounded-xl border border-white/[0.06] bg-[#12151C]/60 px-4 py-3">
        <p className="text-sm font-bold text-white">{q.trainerDisplayName}</p>
        {q.trainerUsername !== "_platform" ? (
          <Link
            href={`/trainers/${encodeURIComponent(q.trainerUsername)}`}
            className="text-xs text-[#FF7E00] underline-offset-2 hover:underline"
          >
            @{q.trainerUsername}
          </Link>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-white/55">{q.focusBlurb}</p>
      </div>
      <p className="text-xs text-white/45">
        {q.lowLabel} → {q.highLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {scale.map((n) => (
          <label
            key={n}
            className={`flex min-w-[2.75rem] cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition ${
              props.value === String(n)
                ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-[#FF7E00]"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name={q.id}
              value={String(n)}
              checked={props.value === String(n)}
              onChange={() => props.onChange(String(n))}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    </div>
  );
}

function InterestPickBlock(props: {
  q: DailyInterestPickQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-semibold text-white/90">{props.q.prompt}</p>
      <ul className="space-y-2">
        {props.q.options.map((o) => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-[#12151C]/40 px-3 py-2.5 transition hover:border-white/12">
              <input
                type="radio"
                name={props.q.id}
                value={o.value}
                checked={props.value === o.value}
                onChange={() => props.onChange(o.value)}
                className="accent-[#FF7E00]"
              />
              <span className="text-sm text-white/85">{titleCaseAnswerLabel(o.label)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FreeTextBlock(props: {
  q: DailyFreeTextQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold text-white/90">{props.q.prompt}</p>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        maxLength={props.q.maxLength}
        rows={4}
        placeholder={props.q.placeholder}
        className="w-full resize-y rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
      />
      <p className="text-right text-[10px] text-white/35">
        {props.value.length}/{props.q.maxLength}
      </p>
    </div>
  );
}
