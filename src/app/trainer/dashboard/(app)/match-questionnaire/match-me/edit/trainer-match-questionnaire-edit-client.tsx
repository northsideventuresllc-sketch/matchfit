"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  type TrainerMatchQuestionnaireDraft,
  validateTrainerMatchQuestionnaireStep,
} from "@/lib/trainer-match-questionnaire-draft";
import type { MatchQuestionnaireEditSlug } from "@/lib/trainer-match-questionnaire-section-meta";
import { MATCH_QUESTIONNAIRE_SECTIONS } from "@/lib/trainer-match-questionnaire-section-meta";
import { TRAINER_MATCH_ME_PATH, TRAINER_MATCH_QUESTIONNAIRES_PATH } from "@/lib/trainer-match-questionnaires-routes";
import {
  AGE_GROUP_IDS,
  AGE_GROUP_LABELS,
  CLIENT_GOAL_IDS,
  CLIENT_GOAL_LABELS,
  CLIENT_LEVEL_IDS,
  CLIENT_LEVEL_LABELS,
  LANGUAGE_IDS,
  LANGUAGE_LABELS,
} from "@/lib/trainer-match-questionnaire";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold text-white/50";

function stableDraftString(d: TrainerMatchQuestionnaireDraft): string {
  return JSON.stringify(d);
}

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

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveModal, setLeaveModal] = useState<{ href: string } | null>(null);

  const d0 = props.initialDraft;
  const [offersVirtual, setOffersVirtual] = useState(d0.offersVirtual);
  const [offersInPerson, setOffersInPerson] = useState(d0.offersInPerson);
  const [inPersonZip, setInPersonZip] = useState(d0.inPersonZip ?? "");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState(
    d0.inPersonRadiusMiles != null ? String(d0.inPersonRadiusMiles) : "",
  );
  const [ageGroups, setAgeGroups] = useState<(typeof AGE_GROUP_IDS)[number][]>([...d0.ageGroups]);
  const [clientLevels, setClientLevels] = useState<(typeof CLIENT_LEVEL_IDS)[number][]>([...d0.clientLevels]);
  const [clientGoals, setClientGoals] = useState<(typeof CLIENT_GOAL_IDS)[number][]>([...d0.clientGoals]);
  const [yearsCoaching, setYearsCoaching] = useState(String(d0.yearsCoaching));
  const [languages, setLanguages] = useState<(typeof LANGUAGE_IDS)[number][]>([...d0.languages]);
  const [coachingPhilosophy, setCoachingPhilosophy] = useState(d0.coachingPhilosophy);
  const [certifyAccurate, setCertifyAccurate] = useState(Boolean(d0.certifyAccurate));

  const [baselineSerialized, setBaselineSerialized] = useState(() => stableDraftString(d0));

  const completed = props.status === "completed";

  const serializeDraft = useCallback((): TrainerMatchQuestionnaireDraft => {
    const radius = inPersonRadiusMiles.trim() === "" ? null : Number(inPersonRadiusMiles);
    const years = Number(yearsCoaching);
    return {
      schemaVersion: 1,
      offersVirtual,
      offersInPerson,
      inPersonZip: offersInPerson ? inPersonZip.trim() || null : null,
      inPersonRadiusMiles: offersInPerson && radius != null && Number.isFinite(radius) ? radius : null,
      ageGroups,
      clientLevels,
      clientGoals,
      yearsCoaching: Number.isFinite(years) ? years : 0,
      coachingPhilosophy,
      languages,
      certifyAccurate,
    };
  }, [
    ageGroups,
    certifyAccurate,
    clientGoals,
    clientLevels,
    coachingPhilosophy,
    inPersonRadiusMiles,
    inPersonZip,
    languages,
    offersInPerson,
    offersVirtual,
    yearsCoaching,
  ]);

  const isDirty = useMemo(() => {
    return stableDraftString(serializeDraft()) !== baselineSerialized;
  }, [serializeDraft, baselineSerialized]);

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

  function toggle<T extends string>(list: T[], value: T, setList: (v: T[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  }

  async function saveDraft(): Promise<boolean> {
    const draft = serializeDraft();
    const err = validateTrainerMatchQuestionnaireStep(draft, props.step);
    if (err) {
      setError(err);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
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
      setBaselineSerialized(stableDraftString(draft));
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
    if (ok) router.push("/trainer/dashboard");
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

  const step = props.step;

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
          ← Questionnaire sections
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

        {step === 1 ? (
          <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <p className="text-sm text-white/55">Toggle every format you are willing to offer.</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
              <input
                type="checkbox"
                checked={offersVirtual}
                onChange={(e) => setOffersVirtual(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#FF7E00]"
              />
              <span className="text-sm text-white/75">Virtual / remote sessions (video, app-based check-ins, etc.)</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
              <input
                type="checkbox"
                checked={offersInPerson}
                onChange={(e) => setOffersInPerson(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#FF7E00]"
              />
              <span className="text-sm text-white/75">In-person sessions at gyms, studios, parks, or client locations</span>
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            {offersInPerson ? (
              <>
                <p className="text-sm text-white/55">
                  Clients searching for in-person trainers need a center point and radius. Use the ZIP where you most
                  often meet clients (you can refine exact locations later).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="zip">
                      ZIP code (center point)
                    </label>
                    <input
                      id="zip"
                      value={inPersonZip}
                      onChange={(e) => setInPersonZip(e.target.value)}
                      placeholder="30301"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="radius">
                      Mile radius
                    </label>
                    <input
                      id="radius"
                      type="number"
                      min={1}
                      max={150}
                      value={inPersonRadiusMiles}
                      onChange={(e) => setInPersonRadiusMiles(e.target.value)}
                      placeholder="e.g. 15"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/55">You chose virtual-only sessions—no travel radius required.</p>
            )}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Clients You Serve Best</h2>
            <div>
              <p className={labelClass}>Age ranges (select all that apply)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {AGE_GROUP_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(ageGroups, id, setAgeGroups)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      ageGroups.includes(id)
                        ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {AGE_GROUP_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={labelClass}>Experience levels you coach well</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CLIENT_LEVEL_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(clientLevels, id, setClientLevels)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      clientLevels.includes(id)
                        ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {CLIENT_LEVEL_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={labelClass}>Primary client goals you support</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CLIENT_GOAL_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(clientGoals, id, setClientGoals)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      clientGoals.includes(id)
                        ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {CLIENT_GOAL_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={labelClass}>Languages you can coach in</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LANGUAGE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(languages, id, setLanguages)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      languages.includes(id)
                        ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {LANGUAGE_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="years">
                Years you have coached or trained people (0 if you are just starting professionally)
              </label>
              <input
                id="years"
                type="number"
                min={0}
                max={60}
                value={yearsCoaching}
                onChange={(e) => setYearsCoaching(e.target.value)}
                className={inputClass}
              />
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Coaching Philosophy & Confirmation</h2>
            <p className="text-sm text-white/55">
              At least a few sentences on how you coach, what clients can expect, and what makes your approach distinct
              (80+ characters).
            </p>
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="phil">
                Coaching philosophy (min 80 characters)
              </label>
              <textarea
                id="phil"
                rows={8}
                value={coachingPhilosophy}
                onChange={(e) => setCoachingPhilosophy(e.target.value)}
                className={inputClass}
                placeholder="Describe your methods, values, communication style, and the outcomes you help clients achieve."
              />
              <p className="text-xs text-white/35">{coachingPhilosophy.trim().length} / 80+ characters</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
              <input
                type="checkbox"
                checked={certifyAccurate}
                onChange={(e) => setCertifyAccurate(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#FF7E00]"
              />
              <span className="text-sm text-white/75">
                I certify that my answers are accurate to the best of my knowledge and that I will keep my Match Fit
                profile updated if my match preferences or coaching details change.
              </span>
            </label>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={TRAINER_MATCH_ME_PATH}
            onClick={(e) => guardedLeave(e, TRAINER_MATCH_ME_PATH)}
            className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/25"
          >
            Back
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate min-h-[3rem] flex-1 overflow-hidden rounded-xl px-4 text-sm font-semibold text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">
              {busy ? "Saving…" : completed ? "Update questionnaire" : "Save questionnaire"}
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
            <h2 id="leave-match-title" className="text-lg font-semibold text-white">
              Unsaved changes
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Save this section before leaving, or discard changes and continue. Cancel stays on this page.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLeaveSave()}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-sm font-semibold text-white transition hover:bg-[#FF7E00]/25 disabled:opacity-50"
              >
                Save & continue
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLeaveDiscard}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white/80 transition hover:border-white/25 disabled:opacity-50"
              >
                Don&apos;t save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setLeaveModal(null)}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/55 transition hover:text-white/80 disabled:opacity-50"
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
