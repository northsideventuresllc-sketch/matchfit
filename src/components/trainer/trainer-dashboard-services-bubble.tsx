"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BILLING_UNIT_LABELS,
  BILLING_UNITS,
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  MATCH_SERVICE_IDS_PT_OFFERING,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import {
  defaultTrainerServiceOfferingsDocument,
  offeringDocumentToDisplayLines,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";
import {
  trainerOffersNutritionServices,
  trainerOffersPersonalTrainingServices,
  trainerSelectedCptTrack,
  trainerSelectedNutritionTrack,
} from "@/lib/trainer-service-buckets";

type OfferingKind = "nutrition" | "personal_training";

type MeResponse = {
  trainer?: {
    username: string;
    profile?: {
      onboardingTrackCpt: boolean;
      onboardingTrackNutrition: boolean;
      certificationReviewStatus: string;
      nutritionistCertificationReviewStatus: string;
      matchQuestionnaireStatus: string;
    };
  };
};

type QuestionnaireResponse = {
  status: string;
  answers: unknown;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold text-white/50";

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  } catch {
    /* ignore */
  }
  return `${fallback} (${res.status})`;
}

function deliveryChoicesForService(serviceId: MatchServiceId): { id: ServiceDeliveryMode; label: string; hint: string }[] {
  const row = MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId);
  if (!row) return [];
  const out: { id: ServiceDeliveryMode; label: string; hint: string }[] = [];
  if (row.virtual) {
    out.push({
      id: "virtual",
      label: "Virtual",
      hint: "Video sessions, remote check-ins, or online delivery.",
    });
  }
  if (row.inPerson) {
    out.push({
      id: "in_person",
      label: "In-person",
      hint: "Meet clients at agreed locations within the radius you set for this package.",
    });
  }
  if (row.virtual && row.inPerson) {
    out.push({
      id: "both",
      label: "Virtual & in-person",
      hint: "Offer this package either online or on-site.",
    });
  }
  return out;
}

export function TrainerDashboardServicesBubble() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse["trainer"] | null>(null);
  const [q, setQ] = useState<QuestionnaireResponse | null>(null);
  const [offeringsDoc, setOfferingsDoc] = useState<TrainerServiceOfferingsDocument | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [screen, setScreen] = useState<"home" | "category" | "service" | "delivery" | "details">("home");
  const [offeringKind, setOfferingKind] = useState<OfferingKind | null>(null);
  const [serviceId, setServiceId] = useState<MatchServiceId | null>(null);
  const [delivery, setDelivery] = useState<ServiceDeliveryMode | null>(null);

  const [priceUsd, setPriceUsd] = useState("");
  const [billingUnit, setBillingUnit] = useState<BillingUnit>("per_session");
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("");
  const [description, setDescription] = useState("");
  const [inPersonZip, setInPersonZip] = useState("");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState("");

  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ profilePath: string; label: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoadErr(null);
    setLoading(true);
    try {
      const [meRes, qRes, oRes] = await Promise.all([
        fetch("/api/trainer/me", { credentials: "include" }),
        fetch("/api/trainer/dashboard/match-questionnaire", { credentials: "include" }),
        fetch("/api/trainer/dashboard/service-offerings", { credentials: "include" }),
      ]);
      if (!meRes.ok) throw new Error(await readApiErrorMessage(meRes, "Could not load your account."));
      if (!qRes.ok) throw new Error(await readApiErrorMessage(qRes, "Could not load Onboarding Questionnaire."));
      if (!oRes.ok) throw new Error(await readApiErrorMessage(oRes, "Could not load published services."));
      const meJson = (await meRes.json()) as MeResponse;
      const qJson = (await qRes.json()) as QuestionnaireResponse;
      const oJson = (await oRes.json()) as { document?: TrainerServiceOfferingsDocument };
      setMe(meJson.trainer ?? null);
      setQ(qJson);
      setOfferingsDoc(oJson.document ?? defaultTrainerServiceOfferingsDocument());
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load.");
      setMe(null);
      setQ(null);
      setOfferingsDoc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draft = useMemo(() => parseTrainerMatchQuestionnaireDraft(q?.answers ?? null), [q?.answers]);

  const profile = me?.profile;
  const bucketProfile =
    profile == null
      ? null
      : {
          onboardingTrackCpt: profile.onboardingTrackCpt,
          onboardingTrackNutrition: profile.onboardingTrackNutrition,
          certificationReviewStatus: profile.certificationReviewStatus,
          nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
        };
  const selectedCpt = Boolean(bucketProfile && trainerSelectedCptTrack(bucketProfile));
  const selectedNutrition = Boolean(bucketProfile && trainerSelectedNutritionTrack(bucketProfile));
  const canOfferPt = Boolean(bucketProfile && trainerOffersPersonalTrainingServices(bucketProfile));
  const canOfferNutrition = Boolean(bucketProfile && trainerOffersNutritionServices(bucketProfile));
  const questionnaireComplete = me?.profile?.matchQuestionnaireStatus === "completed";

  const serviceCatalogForKind = useMemo(() => {
    if (offeringKind === "nutrition") {
      return MATCH_SERVICE_CATALOG.filter((s) => MATCH_SERVICE_IDS_NUTRITION_OFFERING.includes(s.id));
    }
    if (offeringKind === "personal_training") {
      return MATCH_SERVICE_CATALOG.filter((s) => MATCH_SERVICE_IDS_PT_OFFERING.includes(s.id));
    }
    return [];
  }, [offeringKind]);

  const deliveryOptions = useMemo(() => {
    if (!serviceId) return [];
    return deliveryChoicesForService(serviceId);
  }, [serviceId]);

  function resetFlow() {
    setScreen("home");
    setOfferingKind(null);
    setServiceId(null);
    setDelivery(null);
    setPriceUsd("");
    setBillingUnit("per_session");
    setSessionMinutes("");
    setSessionsPerWeek("");
    setDescription("");
    const o = offeringsDoc ?? defaultTrainerServiceOfferingsDocument();
    setInPersonZip((o.inPersonServiceZip ?? draft.inPersonZip ?? "").trim());
    setInPersonRadiusMiles(
      o.inPersonServiceRadiusMiles != null
        ? String(o.inPersonServiceRadiusMiles)
        : draft.inPersonRadiusMiles != null
          ? String(draft.inPersonRadiusMiles)
          : "",
    );
    setFormErr(null);
  }

  useEffect(() => {
    const o = offeringsDoc ?? defaultTrainerServiceOfferingsDocument();
    setInPersonZip((o.inPersonServiceZip ?? draft.inPersonZip ?? "").trim());
    setInPersonRadiusMiles(
      o.inPersonServiceRadiusMiles != null
        ? String(o.inPersonServiceRadiusMiles)
        : draft.inPersonRadiusMiles != null
          ? String(draft.inPersonRadiusMiles)
          : "",
    );
  }, [draft.inPersonZip, draft.inPersonRadiusMiles, offeringsDoc]);

  function startAddFlow() {
    setSuccess(null);
    setFormErr(null);
    if (!selectedCpt && !selectedNutrition) {
      setFormErr("Your account does not have CPT or nutrition paths selected yet. Finish the professional-path step in onboarding.");
      return;
    }
    if (!canOfferPt && !canOfferNutrition) {
      setFormErr(
        "Published services unlock after Match Fit approves your CPT and/or nutrition credentials for each path you selected.",
      );
      return;
    }
    if (!questionnaireComplete) {
      setFormErr(
        "Finish your Onboarding Questionnaire once so your profile is on file. After that, you can publish offerings here without leaving the dashboard.",
      );
      return;
    }
    if (canOfferPt && canOfferNutrition) {
      setScreen("category");
    } else if (canOfferNutrition) {
      setOfferingKind("nutrition");
      setScreen("service");
    } else {
      setOfferingKind("personal_training");
      setScreen("service");
    }
  }

  function onPickCategory(kind: OfferingKind) {
    if (kind === "nutrition" && !canOfferNutrition) return;
    if (kind === "personal_training" && !canOfferPt) return;
    setOfferingKind(kind);
    setScreen("service");
  }

  function onPickService(id: MatchServiceId) {
    setServiceId(id);
    setDelivery(null);
    setScreen("delivery");
  }

  function onPickDelivery(d: ServiceDeliveryMode) {
    setDelivery(d);
    setScreen("details");
  }

  async function onPublish() {
    if (!offeringKind || !serviceId || !delivery || !me?.username) return;
    setFormErr(null);
    const price = Number(priceUsd);
    if (!Number.isFinite(price) || price < 15) {
      setFormErr("Enter a valid price in USD (minimum $15).");
      return;
    }
    if (description.trim().length < 20) {
      setFormErr("Add a short client-facing description (at least 20 characters).");
      return;
    }
    const sm = sessionMinutes.trim() === "" ? undefined : Number(sessionMinutes);
    if (sessionMinutes.trim() !== "" && (!Number.isFinite(sm) || sm! < 15 || sm! > 240)) {
      setFormErr("Session length should be between 15 and 240 minutes, or leave it blank.");
      return;
    }
    const sw = sessionsPerWeek.trim() === "" ? undefined : Number(sessionsPerWeek);
    if (sessionsPerWeek.trim() !== "" && (!Number.isFinite(sw) || sw! < 1 || sw! > 14)) {
      setFormErr("Sessions per week should be 1–14, or leave blank for flexible scheduling.");
      return;
    }

    const needsZip = delivery === "in_person" || delivery === "both";
    const zip = inPersonZip.trim();
    const radius = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);
    if (needsZip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      setFormErr("Enter a valid US ZIP (5 digits or ZIP+4) for in-person coverage.");
      return;
    }
    if (needsZip && (radius == null || !Number.isFinite(radius) || radius < 1 || radius > 150)) {
      setFormErr("Enter a mile radius between 1 and 150 for in-person coverage.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/services/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringKind,
          serviceId,
          priceUsd: price,
          billingUnit,
          description: description.trim(),
          sessionMinutes: sm,
          sessionsPerWeek: sw,
          delivery,
          inPersonZip: needsZip ? zip : undefined,
          inPersonRadiusMiles: needsZip ? radius : undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; profilePath?: string; serviceLabel?: string };
      if (!res.ok) {
        setFormErr(data.error ?? "Could not publish.");
        return;
      }
      setSuccess({ profilePath: data.profilePath ?? trainerPublishedProfilePath(me.username), label: data.serviceLabel ?? "Service" });
      resetFlow();
      await refresh();
    } catch {
      setFormErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const currentLines = useMemo(() => {
    const doc = offeringsDoc ?? defaultTrainerServiceOfferingsDocument();
    return offeringDocumentToDisplayLines(doc);
  }, [offeringsDoc]);

  if (loading || !q || offeringsDoc === null) {
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services &amp; pricing</h2>
        <p className="mt-4 text-center text-sm text-white/55">{loadErr ?? "Loading…"}</p>
        {loadErr ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:border-white/25"
            >
              Try again
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  if (!me) {
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services &amp; pricing</h2>
        <p className="mt-4 text-center text-sm text-white/55">{loadErr ?? "Could not load your trainer session."}</p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:border-white/25"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <div className="text-center">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services &amp; pricing</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/55">
          Set up what you sell, how it is delivered, and what clients should expect—all from your dashboard. Published
          offerings appear on your public profile right away.
        </p>
      </div>

      {success ? (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-sm font-semibold text-emerald-100/95">“{success.label}” is live</p>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            We sent a notification with a link to your profile. Clients can see this service under Services &amp; rates.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={success.profilePath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-emerald-400/55"
            >
              View your profile
            </Link>
            <Link
              href="/trainer/dashboard/notifications"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-xs font-semibold text-white/80 transition hover:border-white/20"
            >
              Open notifications
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/60"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loadErr ? <p className="mt-4 text-center text-sm text-rose-300/90">{loadErr}</p> : null}
      {formErr && !success ? <p className="mt-4 text-center text-sm text-rose-300/90">{formErr}</p> : null}

      {screen === "home" ? (
        <div className="mx-auto mt-6 max-w-xl space-y-5">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">On your profile now</p>
            {currentLines.length ? (
              <ul className="mt-3 space-y-2 text-left text-sm text-white/80">
                {currentLines.map((line, i) => (
                  <li key={i} className="flex gap-2 rounded-lg border border-white/[0.05] bg-[#12151C]/80 px-3 py-2">
                    <span className="font-black text-[#FF7E00]/80">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/50">No published service lines yet—add your first package below.</p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-white/38">
              The Onboarding Questionnaire only stores session format preferences and your in-person matching radius. Packages, prices, and
              delivery for what you sell are managed here—your public profile pulls from this list.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => startAddFlow()}
              className="inline-flex min-h-[3rem] w-full max-w-sm items-center justify-center rounded-2xl border border-[#FF7E00]/45 bg-[#FF7E00]/14 px-6 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#FF7E00]/60 hover:bg-[#FF7E00]/22"
            >
              Add a new service
            </button>
            <p className="text-center text-xs text-white/40">
              To change match preferences (session formats, radius), use Daily Questionnaires in the nav.
            </p>
          </div>
        </div>
      ) : null}

      {screen === "category" ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">What kind of offering is this?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canOfferNutrition}
              onClick={() => onPickCategory("nutrition")}
              className={`rounded-2xl border px-4 py-5 text-left transition ${
                canOfferNutrition
                  ? "border-[#FF7E00]/40 bg-[#FF7E00]/10 hover:border-[#FF7E00]/55"
                  : "cursor-not-allowed border-white/[0.06] bg-[#0E1016]/40 opacity-45"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FF7E00]">Nutrition</p>
              <p className="mt-2 text-xs leading-relaxed text-white/55">
                Coaching, plans, and accountability for clients once your nutrition credential is approved.
              </p>
              {!canOfferNutrition ? (
                <p className="mt-2 text-[10px] font-semibold text-rose-300/90">
                  {selectedNutrition ? "Awaiting approved nutrition credential" : "Nutrition path not selected"}
                </p>
              ) : null}
            </button>
            <button
              type="button"
              disabled={!canOfferPt}
              onClick={() => onPickCategory("personal_training")}
              className={`rounded-2xl border px-4 py-5 text-left transition ${
                canOfferPt
                  ? "border-[#FF7E00]/40 bg-[#FF7E00]/10 hover:border-[#FF7E00]/55"
                  : "cursor-not-allowed border-white/[0.06] bg-[#0E1016]/40 opacity-45"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FF7E00]">Personal training</p>
              <p className="mt-2 text-xs leading-relaxed text-white/55">
                Sessions and programs for clients once your CPT credential is approved.
              </p>
              {!canOfferPt ? (
                <p className="mt-2 text-[10px] font-semibold text-rose-300/90">
                  {selectedCpt ? "Awaiting approved CPT credential" : "CPT path not selected"}
                </p>
              ) : null}
            </button>
          </div>
          <button type="button" onClick={() => resetFlow()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Cancel
          </button>
        </div>
      ) : null}

      {screen === "service" && offeringKind ? (
        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">Choose a service template</p>
          <div className="grid max-h-[min(28rem,55vh)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {serviceCatalogForKind.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickService(s.id)}
                className="rounded-xl border border-white/[0.08] bg-[#0E1016]/60 px-4 py-3 text-left text-sm text-white/85 transition hover:border-[#FF7E00]/40 hover:bg-[#FF7E00]/08"
              >
                <span className="font-semibold text-white">{s.label}</span>
                <span className="mt-1 block text-[11px] text-white/45">
                  {s.virtual && s.inPerson ? "Virtual or in-person" : s.virtual ? "Virtual on Match Fit" : "In-person"}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => resetFlow()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Back
          </button>
        </div>
      ) : null}

      {screen === "delivery" && serviceId ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">How will this be delivered?</p>
          {deliveryOptions.length === 0 ? (
            <p className="text-center text-sm text-rose-300/90">This service template is not available on Match Fit.</p>
          ) : (
            <div className="space-y-2">
              {deliveryOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPickDelivery(opt.id)}
                  className="w-full rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 px-4 py-4 text-left transition hover:border-[#FF7E00]/45"
                >
                  <p className="text-sm font-bold text-white">{opt.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{opt.hint}</p>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setScreen("service")} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Back
          </button>
        </div>
      ) : null}

      {screen === "details" && serviceId && delivery && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">Package details</p>
          <p className="text-center text-xs text-white/45">
            {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
          </p>

          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <div>
              <label className={labelClass}>Price (USD)</label>
              <input className={`${inputClass} mt-1.5`} inputMode="decimal" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder="e.g. 85" />
            </div>
            <div>
              <label className={labelClass}>How you bill</label>
              <select
                className={`${inputClass} mt-1.5`}
                value={billingUnit}
                onChange={(e) => setBillingUnit(e.target.value as BillingUnit)}
              >
                {BILLING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {BILLING_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Session length (optional)</label>
                <input
                  className={`${inputClass} mt-1.5`}
                  inputMode="numeric"
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(e.target.value)}
                  placeholder="Minutes"
                />
              </div>
              <div>
                <label className={labelClass}>Sessions / week (optional)</label>
                <input
                  className={`${inputClass} mt-1.5`}
                  inputMode="numeric"
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
            </div>
            {(delivery === "in_person" || delivery === "both") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>In-person center ZIP</label>
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={inPersonZip}
                    onChange={(e) => setInPersonZip(e.target.value)}
                    placeholder="30301"
                  />
                </div>
                <div>
                  <label className={labelClass}>Radius (miles)</label>
                  <input
                    className={`${inputClass} mt-1.5`}
                    inputMode="numeric"
                    value={inPersonRadiusMiles}
                    onChange={(e) => setInPersonRadiusMiles(e.target.value)}
                    placeholder="15"
                  />
                </div>
              </div>
            )}
            <div>
              <label className={labelClass}>Client-facing description</label>
              <textarea
                className={`${inputClass} mt-1.5 min-h-[7rem] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is included, who it is for, and how you support clients—at least 20 characters."
                maxLength={600}
              />
              <p className="mt-1 text-[10px] text-white/35">{description.trim().length}/600</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPublish()}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45"
            >
              {busy ? "Publishing…" : "Publish to profile"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setScreen("delivery")}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-sm font-semibold text-white/80 hover:border-white/20 disabled:opacity-45"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
