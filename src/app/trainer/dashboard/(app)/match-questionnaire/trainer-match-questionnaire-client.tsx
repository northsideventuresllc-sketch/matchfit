"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AGE_GROUP_IDS,
  AGE_GROUP_LABELS,
  BILLING_UNITS,
  BILLING_UNIT_LABELS,
  CLIENT_GOAL_IDS,
  CLIENT_GOAL_LABELS,
  CLIENT_LEVEL_IDS,
  CLIENT_LEVEL_LABELS,
  LANGUAGE_IDS,
  LANGUAGE_LABELS,
  MATCH_SERVICE_CATALOG,
  type BillingUnit,
  type MatchServiceId,
  type TrainerMatchQuestionnairePayload,
  serviceAllowedForFormats,
  trainerMatchQuestionnaireSchema,
} from "@/lib/trainer-match-questionnaire";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

type Props = {
  initialPayload: TrainerMatchQuestionnairePayload | null;
  status: string;
  completedAtIso: string | null;
};

function emptyServiceMap(): Record<MatchServiceId, { priceUsd: string; billingUnit: BillingUnit } | null> {
  const o = {} as Record<MatchServiceId, { priceUsd: string; billingUnit: BillingUnit } | null>;
  for (const s of MATCH_SERVICE_CATALOG) {
    o[s.id] = null;
  }
  return o;
}

export function TrainerMatchQuestionnaireClient(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [offersVirtual, setOffersVirtual] = useState(false);
  const [offersInPerson, setOffersInPerson] = useState(false);
  const [services, setServices] = useState(() => emptyServiceMap());
  const [inPersonZip, setInPersonZip] = useState("");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState("");
  const [ageGroups, setAgeGroups] = useState<(typeof AGE_GROUP_IDS)[number][]>([]);
  const [clientLevels, setClientLevels] = useState<(typeof CLIENT_LEVEL_IDS)[number][]>([]);
  const [clientGoals, setClientGoals] = useState<(typeof CLIENT_GOAL_IDS)[number][]>([]);
  const [yearsCoaching, setYearsCoaching] = useState("");
  const [languages, setLanguages] = useState<(typeof LANGUAGE_IDS)[number][]>([]);
  const [coachingPhilosophy, setCoachingPhilosophy] = useState("");
  const [certifyAccurate, setCertifyAccurate] = useState(false);

  const hydrate = useCallback((p: TrainerMatchQuestionnairePayload) => {
    setOffersVirtual(p.offersVirtual);
    setOffersInPerson(p.offersInPerson);
    const next = emptyServiceMap();
    for (const line of p.services) {
      next[line.serviceId] = { priceUsd: String(line.priceUsd), billingUnit: line.billingUnit };
    }
    setServices(next);
    setInPersonZip(p.inPersonZip ?? "");
    setInPersonRadiusMiles(p.inPersonRadiusMiles != null ? String(p.inPersonRadiusMiles) : "");
    setAgeGroups([...p.ageGroups]);
    setClientLevels([...p.clientLevels]);
    setClientGoals([...p.clientGoals]);
    setYearsCoaching(String(p.yearsCoaching));
    setLanguages([...p.languages]);
    setCoachingPhilosophy(p.coachingPhilosophy);
    setCertifyAccurate(Boolean(p.certifyAccurate));
  }, []);

  useEffect(() => {
    if (props.initialPayload) {
      // Server-provided initial questionnaire state; must run after navigation.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- `hydrate` applies one-time SSR payload into controlled fields
      hydrate(props.initialPayload);
    }
  }, [props.initialPayload, hydrate]);

  const completed = props.status === "completed";

  function toggle<T extends string>(list: T[], value: T, setList: (v: T[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  }

  function buildPayloadBody(): Omit<TrainerMatchQuestionnairePayload, "certifyAccurate"> {
    const lines: TrainerMatchQuestionnairePayload["services"] = [];
    for (const s of MATCH_SERVICE_CATALOG) {
      const row = services[s.id];
      if (row) {
        const price = Number(row.priceUsd);
        if (!Number.isFinite(price)) continue;
        lines.push({ serviceId: s.id, priceUsd: price, billingUnit: row.billingUnit });
      }
    }
    const radius = inPersonRadiusMiles.trim() === "" ? null : Number(inPersonRadiusMiles);
    const years = Number(yearsCoaching);
    return {
      schemaVersion: 1,
      offersVirtual,
      offersInPerson,
      services: lines,
      inPersonZip: offersInPerson ? inPersonZip.trim() || null : null,
      inPersonRadiusMiles: offersInPerson && radius != null && Number.isFinite(radius) ? radius : null,
      ageGroups,
      clientLevels,
      clientGoals,
      yearsCoaching: Number.isFinite(years) ? years : 0,
      coachingPhilosophy,
      languages,
    };
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!offersVirtual && !offersInPerson) return "Select at least one session format.";
    }
    if (s === 2) {
      const lines = MATCH_SERVICE_CATALOG.filter((x) => services[x.id]);
      if (lines.length === 0) return "Select at least one service and set a price.";
      for (const x of lines) {
        const row = services[x.id];
        if (!row) continue;
        const price = Number(row.priceUsd);
        if (!Number.isFinite(price) || price < 15) return `Enter a valid price (USD, min $15) for ${x.label}.`;
        if (!serviceAllowedForFormats(x.id, offersVirtual, offersInPerson)) {
          return `“${x.label}” does not match your session formats—adjust formats or services.`;
        }
      }
    }
    if (s === 3) {
      if (!offersInPerson) return null;
      if (!/^\d{5}(-\d{4})?$/.test(inPersonZip.trim())) return "Enter a valid US ZIP for your in-person radius.";
      const r = Number(inPersonRadiusMiles);
      if (!Number.isFinite(r) || r < 1 || r > 150) return "Enter a mile radius between 1 and 150.";
    }
    if (s === 4) {
      if (ageGroups.length === 0) return "Select at least one age range.";
      if (clientLevels.length === 0) return "Select at least one client experience level.";
      if (clientGoals.length === 0) return "Select at least one client goal.";
      if (languages.length === 0) return "Select at least one language.";
      const y = Number(yearsCoaching);
      if (!Number.isFinite(y) || y < 0 || y > 60) return "Enter years coaching between 0 and 60.";
    }
    if (s === 5) {
      if (coachingPhilosophy.trim().length < 80) return "Coaching philosophy must be at least 80 characters.";
      if (!certifyAccurate) return "Confirm that your answers are accurate.";
      const parsed = trainerMatchQuestionnaireSchema.safeParse({
        ...buildPayloadBody(),
        certifyAccurate: true,
      });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "Review your answers.";
    }
    return null;
  }

  function nextStep() {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    if (step === 2 && !offersInPerson) {
      setStep(4);
      return;
    }
    setStep((v) => Math.min(5, v + 1));
  }

  function prevStep() {
    setError(null);
    if (step === 4 && !offersInPerson) {
      setStep(2);
      return;
    }
    setStep((v) => Math.max(1, v - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validateStep(5);
    if (err) {
      setError(err);
      return;
    }
    const body = buildPayloadBody();
    const finalPayload = { ...body, certifyAccurate: true as const };
    const parsed = trainerMatchQuestionnaireSchema.safeParse(finalPayload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid data.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/match-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={step === 5 ? handleSubmit : (e) => e.preventDefault()} className="space-y-8">
      {completed ? (
        <p
          className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          Match Me is on file
          {props.completedAtIso
            ? ` (submitted ${new Date(props.completedAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})`
            : ""}
          . Your structured answers and AI-readable profile are saved—check your dashboard for the full text. Submit
          again anytime to update.
        </p>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-sm text-white/55">
          Required onboarding: all steps below must be completed. We store JSON for your services and rates, plus a
          plain-text “Match Me” profile for client search and AI pairing.
        </p>
      )}

      <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">
        Step {step} of 5 · Formats → Services & prices → In-person area → Clients & goals → Philosophy
      </p>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <h2 className="text-lg font-black text-white">Session formats</h2>
          <p className="text-sm text-white/55">Select every format you are willing to offer. Pricing comes next.</p>
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
        <section className="space-y-5 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <h2 className="text-lg font-black text-white">Services & pricing</h2>
          <p className="text-sm text-white/55">
            Turn on each service you sell and set your rate. Only options compatible with your session formats are
            shown.
          </p>
          <div className="space-y-4">
            {MATCH_SERVICE_CATALOG.filter(
              (s) => (offersVirtual && s.virtual) || (offersInPerson && s.inPerson),
            ).map((s) => {
              const row = services[s.id];
              const on = Boolean(row);
              return (
                <div key={s.id} className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/70 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        setServices((prev) => ({
                          ...prev,
                          [s.id]: e.target.checked
                            ? { priceUsd: "75", billingUnit: "per_session" as BillingUnit }
                            : null,
                        }));
                      }}
                      className="h-4 w-4 accent-[#FF7E00]"
                    />
                    <span className="text-sm font-semibold text-white">{s.label}</span>
                  </label>
                  {on ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className={labelClass} htmlFor={`price-${s.id}`}>
                          Price (USD)
                        </label>
                        <input
                          id={`price-${s.id}`}
                          type="number"
                          min={15}
                          max={5000}
                          step={1}
                          value={row?.priceUsd ?? ""}
                          onChange={(e) =>
                            setServices((prev) => ({
                              ...prev,
                              [s.id]: { ...(prev[s.id] as { priceUsd: string; billingUnit: BillingUnit }), priceUsd: e.target.value },
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={labelClass} htmlFor={`unit-${s.id}`}>
                          Billing
                        </label>
                        <select
                          id={`unit-${s.id}`}
                          value={row?.billingUnit ?? "per_session"}
                          onChange={(e) =>
                            setServices((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] as { priceUsd: string; billingUnit: BillingUnit }),
                                billingUnit: e.target.value as BillingUnit,
                              },
                            }))
                          }
                          className={inputClass}
                          style={{ colorScheme: "dark" }}
                        >
                          {BILLING_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {BILLING_UNIT_LABELS[u]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <h2 className="text-lg font-black text-white">In-person service area</h2>
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

      {step === 4 ? (
        <section className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <h2 className="text-lg font-black text-white">Clients you serve best</h2>
          <div>
            <p className={labelClass}>Age ranges (select all that apply)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {AGE_GROUP_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(ageGroups, id, setAgeGroups)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
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

      {step === 5 ? (
        <section className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <h2 className="text-lg font-black text-white">Coaching philosophy & confirmation</h2>
          <p className="text-sm text-white/55">
            Write at least a few sentences about how you coach, what clients can expect, and what makes your approach
            unique. This text is shown to the matching engine and may appear in search previews.
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
              profile updated if my offerings or pricing change.
            </span>
          </label>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={prevStep}
            className="min-h-[3rem] flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            Back
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {step < 5 ? (
          <button
            type="button"
            onClick={nextStep}
            className="group relative isolate min-h-[3rem] flex-1 overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition active:translate-y-px"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">Continue</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate min-h-[3rem] flex-1 overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">{busy ? "Saving…" : completed ? "Update Match Me" : "Save Match Me"}</span>
          </button>
        )}
      </div>
    </form>
  );
}
