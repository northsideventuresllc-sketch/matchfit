"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BILLING_UNIT_LABELS,
  BILLING_UNITS,
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  MATCH_SERVICE_IDS_PT_OFFERING,
  matchServiceAllowsMultiSessionBilling,
  serviceOfferingIsDiyTemplate,
  serviceOfferingNeedsSessionLength,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import type { PriceCheckResult } from "@/lib/trainer-offering-price-suggest";
import {
  defaultTrainerServiceOfferingsDocument,
  effectiveSessionFrequencyKind,
  mergeServiceOfferingFrequencyFields,
  minListPriceUsdOnLine,
  resolvedTrainerServicePublicTitle,
  TRAINER_SERVICE_PUBLIC_TITLE_MAX,
  type ServiceOfferingFrequencyDto,
  type SessionFrequencyKind,
  type TrainerServiceOfferingBundleTier,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingVariation,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { templateVariationsForService } from "@/lib/trainer-service-variation-presets";
import {
  formatTrainerServicePriceUsd,
  parseTrainerServicePriceUsdInput,
  sanitizeTrainerServicePriceUsdTyping,
} from "@/lib/trainer-service-price-display";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";
import {
  trainerHasPersonalTrainingPathSelected,
  trainerOffersNutritionServices,
  trainerOffersPersonalTrainingServices,
  trainerSelectedNutritionTrack,
} from "@/lib/trainer-service-buckets";

function newVariationId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newBundleTierId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `t_${c.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type OfferingKind = "nutrition" | "personal_training";

type MeResponse = {
  trainer?: {
    username: string;
    profile?: {
      onboardingTrackCpt: boolean;
      onboardingTrackNutrition: boolean;
      onboardingTrackSpecialist: boolean;
      certificationReviewStatus: string;
      nutritionistCertificationReviewStatus: string;
      specialistCertificationReviewStatus: string;
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

/** Field labels above inputs — rendered in all caps for scanability. */
const labelClass = "text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50";

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  } catch {
    /* ignore */
  }
  return `${fallback} (${res.status})`;
}

function offeringKindFromServiceId(id: MatchServiceId): OfferingKind {
  return MATCH_SERVICE_IDS_NUTRITION_OFFERING.includes(id) ? "nutrition" : "personal_training";
}

const DELIVERY_LABEL: Record<ServiceDeliveryMode, string> = {
  virtual: "Virtual",
  in_person: "In-Person",
  both: "Virtual and In-Person",
};

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
      label: "In-Person",
      hint: "Meet clients at agreed locations within the radius you set for this package.",
    });
  }
  if (row.virtual && row.inPerson) {
    out.push({
      id: "both",
      label: "Virtual and In-Person",
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
  const [sessionFrequencyKind, setSessionFrequencyKind] = useState<SessionFrequencyKind>("none");
  const [sessionFrequencyCount, setSessionFrequencyCount] = useState("");
  const [sessionFrequencyCustom, setSessionFrequencyCustom] = useState("");
  const [description, setDescription] = useState("");
  const [publicTitle, setPublicTitle] = useState("");
  const [inPersonZip, setInPersonZip] = useState("");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState("");
  const [variations, setVariations] = useState<TrainerServiceOfferingVariation[]>([]);
  const [priceCheckAiEnabled, setPriceCheckAiEnabled] = useState(true);

  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ profilePath: string; label: string } | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<MatchServiceId | null>(null);
  const [priceModal, setPriceModal] = useState<null | { loading: boolean; result?: PriceCheckResult & { aiDisabled?: boolean } }>(
    null,
  );
  const [priceModalBusy, setPriceModalBusy] = useState(false);
  const priceModalCancelledRef = useRef(false);

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
          onboardingTrackSpecialist: profile.onboardingTrackSpecialist,
          certificationReviewStatus: profile.certificationReviewStatus,
          nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
          specialistCertificationReviewStatus: profile.specialistCertificationReviewStatus,
        };
  const selectedPtPath = Boolean(bucketProfile && trainerHasPersonalTrainingPathSelected(bucketProfile));
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

  const billingUnitOptions = useMemo(() => {
    if (!serviceId) return [...BILLING_UNITS];
    return BILLING_UNITS.filter((u) => u !== "multi_session" || matchServiceAllowsMultiSessionBilling(serviceId));
  }, [serviceId]);

  const needsSessionLength = Boolean(
    serviceId && delivery && serviceOfferingNeedsSessionLength(serviceId, delivery),
  );

  useEffect(() => {
    if (serviceId && !matchServiceAllowsMultiSessionBilling(serviceId) && billingUnit === "multi_session") {
      setBillingUnit("per_session");
    }
  }, [serviceId, billingUnit]);

  function resetFlow() {
    setScreen("home");
    setOfferingKind(null);
    setServiceId(null);
    setDelivery(null);
    setEditingServiceId(null);
    setPriceUsd("");
    setBillingUnit("per_session");
    setSessionMinutes("");
    setSessionFrequencyKind("none");
    setSessionFrequencyCount("");
    setSessionFrequencyCustom("");
    setDescription("");
    setPublicTitle("");
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
    setVariations([]);
    setPriceCheckAiEnabled(true);
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
    if (!selectedPtPath && !selectedNutrition) {
      setFormErr(
        "Your account does not have a training path (CPT or specialist) or nutrition path selected yet. Finish the professional-path step in onboarding.",
      );
      return;
    }
    if (!canOfferPt && !canOfferNutrition) {
      setFormErr(
        "Published services unlock after Match Fit approves the credentials for each path you selected (CPT or specialist for training; nutrition credential for nutrition).",
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

  function parsePriceUsdField(): number | null {
    const n = parseTrainerServicePriceUsdInput(priceUsd);
    if (n == null || !Number.isFinite(n)) return null;
    return n;
  }

  /** Fields shared by market price-check requests (benchmark + OpenAI). */
  function priceCheckListingPayload(): Record<string, unknown> {
    if (!delivery) return {};
    const out: Record<string, unknown> = { sessionFrequencyKind };
    const sm = sessionMinutes.trim() === "" ? undefined : Number(sessionMinutes);
    if (sm != null && Number.isFinite(sm) && sm >= 15 && sm <= 240) {
      out.sessionMinutes = sm;
    }
    if (sessionFrequencyKind === "per_week" || sessionFrequencyKind === "per_month") {
      const n = Number(sessionFrequencyCount.trim());
      if (Number.isFinite(n)) out.sessionFrequencyCount = Math.floor(n);
    }
    if (sessionFrequencyKind === "custom" && sessionFrequencyCustom.trim()) {
      out.sessionFrequencyCustom = sessionFrequencyCustom.trim();
    }
    if (delivery === "in_person" || delivery === "both") {
      const zip = inPersonZip.trim();
      if (zip) out.inPersonZip = zip;
      const r = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);
      if (r != null && Number.isFinite(r) && r >= 1 && r <= 150) {
        out.inPersonRadiusMiles = Math.floor(r);
      }
    }
    if (variations.length > 0) {
      out.variations = variations;
    }
    if (!priceCheckAiEnabled) {
      out.priceCheckAiEnabled = false;
    }
    return out;
  }

  function buildFrequencyBody(): ServiceOfferingFrequencyDto {
    const freqBody: ServiceOfferingFrequencyDto = { sessionFrequencyKind };
    if (sessionFrequencyKind === "per_week") {
      const n = Number(sessionFrequencyCount.trim());
      freqBody.sessionFrequencyCount = n;
      freqBody.sessionsPerWeek = n;
    } else if (sessionFrequencyKind === "per_month") {
      freqBody.sessionFrequencyCount = Number(sessionFrequencyCount.trim());
    } else if (sessionFrequencyKind === "custom") {
      freqBody.sessionFrequencyCustom = sessionFrequencyCustom.trim();
    }
    return freqBody;
  }

  function buildTentativeOfferingLine(): TrainerServiceOfferingLine | null {
    if (!serviceId || !delivery) return null;
    const sm = sessionMinutes.trim() === "" ? undefined : Number(sessionMinutes);
    const pub = publicTitle.trim();
    const desc = description.trim();
    const anchor = parsePriceUsdField();
    const line: TrainerServiceOfferingLine = {
      serviceId,
      delivery,
      billingUnit,
      priceUsd: anchor != null && anchor >= 15 && anchor <= 5000 ? anchor : 100,
      description: desc.length >= 20 ? desc : "xxxxxxxxxxxxxxxxxxxx",
      sessionMinutes: variations.length > 0 ? undefined : sm,
      variations: variations.length > 0 ? variations : undefined,
    };
    mergeServiceOfferingFrequencyFields(line, buildFrequencyBody());
    if (pub) line.publicTitle = pub;
    if (variations.length > 0) {
      line.priceUsd = minListPriceUsdOnLine(line);
    }
    return line;
  }

  function validateDetails(priceOverride?: number): string | null {
    if (!offeringKind || !serviceId || !delivery) return "Complete all steps first.";
    if (publicTitle.trim().length > TRAINER_SERVICE_PUBLIC_TITLE_MAX) {
      return `Public title must be ${TRAINER_SERVICE_PUBLIC_TITLE_MAX} characters or fewer.`;
    }
    if (description.trim().length < 20) {
      return "Add a short client-facing description (at least 20 characters).";
    }
    const sm = sessionMinutes.trim() === "" ? undefined : Number(sessionMinutes);
    if (variations.length > 0) {
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]!;
        if (!v.label.trim()) return `Option ${i + 1}: enter a label.`;
        if (v.priceUsd < 15 || v.priceUsd > 5000) return `Option ${i + 1}: price must be between $15 and $5,000.`;
        if (!matchServiceAllowsMultiSessionBilling(serviceId) && v.billingUnit === "multi_session") {
          return `Option ${i + 1}: this template cannot bill as a multi-session package.`;
        }
        if (needsSessionLength && !serviceOfferingIsDiyTemplate(serviceId)) {
          const m = v.sessionMinutes;
          if (m == null || !Number.isFinite(m) || m < 15 || m > 240) {
            return `Option ${i + 1}: enter session length (15–240 minutes) for this template.`;
          }
        }
        const tiers = v.bundleTiers ?? [];
        for (let j = 0; j < tiers.length; j++) {
          const t = tiers[j]!;
          if (!Number.isFinite(t.quantity) || t.quantity < 2 || t.quantity > 52) {
            return `Option ${i + 1}, bundle ${j + 1}: quantity must be 2–52 sessions.`;
          }
          if (!Number.isFinite(t.priceUsd) || t.priceUsd < 15 || t.priceUsd > 50_000) {
            return `Option ${i + 1}, bundle ${j + 1}: total price must be between $15 and $50,000.`;
          }
        }
      }
      const tentative = buildTentativeOfferingLine();
      const listMin = tentative ? minListPriceUsdOnLine(tentative) : null;
      if (listMin == null || !Number.isFinite(listMin)) return "Fix option prices before continuing.";
      const price = priceOverride ?? listMin;
      if (price < 15 || price > 5000) return "Lowest option price must stay between $15 and $5,000.";
    } else {
      const price = priceOverride ?? parsePriceUsdField();
      if (price == null || price < 15) return "Enter a valid price in USD (minimum $15).";
      if (price > 5000) return "Maximum list price is $5,000.";
      if (needsSessionLength) {
        if (sm == null || !Number.isFinite(sm) || sm < 15 || sm > 240) {
          return "Session length is required (15–240 minutes) for virtual or in-person packages on this template.";
        }
      } else if (sessionMinutes.trim() !== "" && (!Number.isFinite(sm) || sm! < 15 || sm! > 240)) {
        return "Session length should be between 15 and 240 minutes, or leave it blank.";
      }
    }
    if (sessionFrequencyKind === "per_week") {
      const n = Number(sessionFrequencyCount.trim());
      if (!Number.isFinite(n) || n < 1 || n > 14) return "Enter sessions per week (1–14).";
    }
    if (sessionFrequencyKind === "per_month") {
      const n = Number(sessionFrequencyCount.trim());
      if (!Number.isFinite(n) || n < 1 || n > 31) return "Enter sessions per month (1–31).";
    }
    if (sessionFrequencyKind === "custom" && sessionFrequencyCustom.trim().length < 3) {
      return "Describe your cadence (at least 3 characters) or pick another option.";
    }
    const needsZip = delivery === "in_person" || delivery === "both";
    const zip = inPersonZip.trim();
    const radius = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);
    if (needsZip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      return "Enter a valid US ZIP (5 digits or ZIP+4) for in-person coverage.";
    }
    if (needsZip && (radius == null || !Number.isFinite(radius) || radius < 1 || radius > 150)) {
      return "Enter max drive distance between 1 and 150 miles for in-person coverage.";
    }
    return null;
  }

  async function fetchPriceCheckFull(price: number): Promise<PriceCheckResult | null> {
    if (!serviceId || !delivery) return null;
    const res = await fetch("/api/trainer/dashboard/services/price-check", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        publicTitle: publicTitle.trim() || undefined,
        billingUnit,
        delivery,
        priceUsd: price,
        description: description.trim(),
        mode: "full",
        ...priceCheckListingPayload(),
      }),
    });
    if (!res.ok) {
      setFormErr(await readApiErrorMessage(res, "Could not analyze pricing."));
      return null;
    }
    return (await res.json()) as PriceCheckResult & { aiDisabled?: boolean };
  }

  async function openPriceCheckModal() {
    setFormErr(null);
    const err = validateDetails();
    if (err) {
      setFormErr(err);
      return;
    }
    const tentative = buildTentativeOfferingLine();
    const price =
      variations.length > 0 && tentative
        ? minListPriceUsdOnLine(tentative)
        : parsePriceUsdField();
    if (price == null || !Number.isFinite(price)) {
      setFormErr("Enter a valid price in USD.");
      return;
    }
    priceModalCancelledRef.current = false;
    setPriceModal({ loading: true });
    const result = await fetchPriceCheckFull(price);
    if (priceModalCancelledRef.current) return;
    if (!result) {
      setPriceModal(null);
      return;
    }
    setPriceModal({ loading: false, result });
  }

  async function onModalAutoGeneratePrice() {
    if (!serviceId || !delivery) return;
    if (variations.length > 0) {
      setFormErr("Auto-generate is only available for single-price packages. Clear package options or set prices manually.");
      return;
    }
    setFormErr(null);
    const err = validateDetails();
    if (err) {
      setFormErr(err);
      return;
    }
    priceModalCancelledRef.current = false;
    setPriceModalBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/services/price-check", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          publicTitle: publicTitle.trim() || undefined,
          billingUnit,
          delivery,
          priceUsd: Math.min(5000, Math.max(15, parsePriceUsdField() ?? 100)),
          description: description.trim(),
          mode: "auto_only",
          ...priceCheckListingPayload(),
        }),
      });
      if (priceModalCancelledRef.current) return;
      if (!res.ok) {
        setFormErr(await readApiErrorMessage(res, "Could not generate a price."));
        return;
      }
      const j = (await res.json()) as { suggestedPriceUsd?: number };
      const suggested = typeof j.suggestedPriceUsd === "number" && Number.isFinite(j.suggestedPriceUsd) ? j.suggestedPriceUsd : null;
      if (suggested == null) {
        setFormErr("Could not generate a price. Try again.");
        return;
      }
      setPriceUsd(String(suggested));
      setPriceModal({ loading: true });
      const full = await fetchPriceCheckFull(suggested);
      if (priceModalCancelledRef.current) return;
      if (!full) {
        setPriceModal(null);
        return;
      }
      setPriceModal({ loading: false, result: full });
    } catch {
      setFormErr("Network error. Try again.");
    } finally {
      setPriceModalBusy(false);
    }
  }

  async function executePublish(finalPriceUsd: number) {
    if (!offeringKind || !serviceId || !delivery || !me?.username) return;
    setFormErr(null);
    const tentative = buildTentativeOfferingLine();
    const effectiveListPrice =
      variations.length > 0 && tentative ? minListPriceUsdOnLine(tentative) : finalPriceUsd;
    const err = validateDetails(variations.length > 0 ? effectiveListPrice : finalPriceUsd);
    if (err) {
      setFormErr(err);
      return;
    }
    const sm = sessionMinutes.trim() === "" ? undefined : Number(sessionMinutes);
    const needsZip = delivery === "in_person" || delivery === "both";
    const zip = inPersonZip.trim();
    const radius = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);

    const freqBody = buildFrequencyBody();

    const isEdit = editingServiceId != null;
    const pub = publicTitle.trim();
    const baseBody = {
      priceUsd: effectiveListPrice,
      billingUnit,
      description: description.trim(),
      sessionMinutes: variations.length > 0 ? undefined : sm,
      delivery,
      inPersonZip: needsZip ? zip : undefined,
      inPersonRadiusMiles: needsZip ? radius : undefined,
      ...freqBody,
    };

    const aiBody =
      priceCheckAiEnabled === false
        ? { priceCheckAiEnabled: false as const }
        : isEdit
          ? { priceCheckAiEnabled: true as const }
          : {};

    setBusy(true);
    try {
      const patchBody = { ...baseBody, publicTitle: pub, variations, ...aiBody };
      const publishBody = {
        offeringKind,
        serviceId,
        ...baseBody,
        ...(pub ? { publicTitle: pub } : {}),
        ...(variations.length > 0 ? { variations } : {}),
        ...(!isEdit && priceCheckAiEnabled === false ? { priceCheckAiEnabled: false as const } : {}),
      };
      const res = await fetch(
        isEdit
          ? `/api/trainer/dashboard/services/${encodeURIComponent(serviceId)}`
          : "/api/trainer/dashboard/services/publish",
        {
          method: isEdit ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? patchBody : publishBody),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; profilePath?: string; serviceLabel?: string };
      if (!res.ok) {
        setFormErr(data.error ?? (isEdit ? "Could not save changes." : "Could not publish."));
        return;
      }
      setSuccess({
        profilePath: data.profilePath ?? trainerPublishedProfilePath(me.username),
        label: data.serviceLabel ?? "Service",
      });
      setPriceModal(null);
      resetFlow();
      await refresh();
    } catch {
      setFormErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(line: TrainerServiceOfferingLine) {
    setSuccess(null);
    setFormErr(null);
    if (!questionnaireComplete) {
      setFormErr(
        "Finish your Onboarding Questionnaire once so your profile is on file. After that, you can edit offerings here without leaving the dashboard.",
      );
      return;
    }
    const kind = offeringKindFromServiceId(line.serviceId);
    if (kind === "nutrition" && !canOfferNutrition) {
      setFormErr("You cannot edit nutrition offerings until your nutrition credential is approved.");
      return;
    }
    if (kind === "personal_training" && !canOfferPt) {
      setFormErr("You cannot edit training offerings until your CPT or specialist credential is approved.");
      return;
    }
    setEditingServiceId(line.serviceId);
    setOfferingKind(kind);
    setServiceId(line.serviceId);
    setDelivery(line.delivery);
    setPriceUsd(formatTrainerServicePriceUsd(line.priceUsd));
    setBillingUnit(line.billingUnit);
    setSessionMinutes(line.sessionMinutes != null ? String(line.sessionMinutes) : "");
    const fk = effectiveSessionFrequencyKind(line);
    setSessionFrequencyKind(fk);
    if (fk === "per_week") {
      setSessionFrequencyCount(String(line.sessionFrequencyCount ?? line.sessionsPerWeek ?? ""));
    } else if (fk === "per_month") {
      setSessionFrequencyCount(String(line.sessionFrequencyCount ?? ""));
    } else {
      setSessionFrequencyCount("");
    }
    setSessionFrequencyCustom(line.sessionFrequencyCustom ?? "");
    setDescription(line.description ?? "");
    setPublicTitle(line.publicTitle ?? "");
    setVariations(line.variations && line.variations.length > 0 ? [...line.variations] : []);
    setPriceCheckAiEnabled(line.priceCheckAiEnabled !== false);
    const o = offeringsDoc ?? defaultTrainerServiceOfferingsDocument();
    setInPersonZip((o.inPersonServiceZip ?? draft.inPersonZip ?? "").trim());
    setInPersonRadiusMiles(
      o.inPersonServiceRadiusMiles != null
        ? String(o.inPersonServiceRadiusMiles)
        : draft.inPersonRadiusMiles != null
          ? String(draft.inPersonRadiusMiles)
          : "",
    );
    setScreen("details");
  }

  async function removeServiceRow(sid: MatchServiceId) {
    const line = (offeringsDoc ?? defaultTrainerServiceOfferingsDocument()).services.find((s) => s.serviceId === sid);
    const label = line ? resolvedTrainerServicePublicTitle(line) : (MATCH_SERVICE_CATALOG.find((s) => s.id === sid)?.label ?? sid);
    if (!window.confirm(`Remove “${label}” from your public profile?`)) return;
    setFormErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/trainer/dashboard/services/${encodeURIComponent(sid)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setFormErr(await readApiErrorMessage(res, "Could not remove service."));
        return;
      }
      await refresh();
    } catch {
      setFormErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const publishedServices = useMemo(
    () => (offeringsDoc ?? defaultTrainerServiceOfferingsDocument()).services,
    [offeringsDoc],
  );

  if (loading || !q || offeringsDoc === null) {
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services and pricing</h2>
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
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services and pricing</h2>
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
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services and pricing</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/55">
          Set up what you sell, how it is delivered, and what clients should expect, all from your dashboard. Published
          offerings appear on your public profile right away.
        </p>
      </div>

      {success ? (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-sm font-semibold text-emerald-100/95">“{success.label}” is live</p>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            We sent a notification with a link to your profile. Clients can see this service under Services and rates.
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
            {publishedServices.length ? (
              <ul className="mt-3 space-y-2 text-left text-sm text-white/80">
                {publishedServices.map((line) => {
                  const cat = MATCH_SERVICE_CATALOG.find((s) => s.id === line.serviceId);
                  return (
                    <li
                      key={line.serviceId}
                      className="flex flex-col gap-2 rounded-lg border border-white/[0.05] bg-[#12151C]/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{resolvedTrainerServicePublicTitle(line)}</p>
                        {line.publicTitle?.trim() ? (
                          <p className="mt-0.5 text-[10px] text-white/38">
                            <span className="font-semibold uppercase tracking-wide">Match Fit template</span>:{" "}
                            {cat?.label ?? line.serviceId}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-white/50">
                          {line.variations && line.variations.length > 0 ? (
                            <>
                              From {formatTrainerServicePriceUsd(minListPriceUsdOnLine(line))} ·{" "}
                              {line.variations.length} option{line.variations.length === 1 ? "" : "s"} ·{" "}
                            </>
                          ) : (
                            <>
                              {formatTrainerServicePriceUsd(line.priceUsd)} · {BILLING_UNIT_LABELS[line.billingUnit]} ·{" "}
                            </>
                          )}
                          {DELIVERY_LABEL[line.delivery]}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => beginEdit(line)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/85 hover:border-[#FF7E00]/45 disabled:opacity-45"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeServiceRow(line.serviceId)}
                          className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-200/90 hover:border-rose-400/50 disabled:opacity-45"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/50">No published services yet. Add your first package below.</p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-white/38">
              The Onboarding Questionnaire only stores session format preferences and your in-person matching radius. Packages, prices, and
              delivery for what you sell are managed here. Your public profile pulls from this list.
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
              To change match preferences (session formats, radius), use Daily Questionnaires in the navigation.
            </p>
          </div>
        </div>
      ) : null}

      {screen === "category" ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">What Kind of Offering Is This?</p>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canOfferNutrition}
              onClick={() => onPickCategory("nutrition")}
              className={`flex min-h-[10.5rem] flex-col rounded-2xl border px-4 py-5 text-left transition sm:min-h-[11.5rem] ${
                canOfferNutrition
                  ? "border-[#FF7E00]/40 bg-[#FF7E00]/10 hover:border-[#FF7E00]/55"
                  : "cursor-not-allowed border-white/[0.06] bg-[#0E1016]/40 opacity-45"
              }`}
            >
              <p className="text-xs font-bold tracking-wide text-[#FF7E00]">Nutrition</p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-white/55">
                Coaching, plans, and accountability for clients once your nutrition credential is approved.
              </p>
              <div className="mt-3 min-h-[2.25rem]">
                {!canOfferNutrition ? (
                  <p className="text-[10px] font-semibold text-rose-300/90">
                    {selectedNutrition ? "Awaiting approved nutrition credential" : "Nutrition path not selected"}
                  </p>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              disabled={!canOfferPt}
              onClick={() => onPickCategory("personal_training")}
              className={`flex min-h-[10.5rem] flex-col rounded-2xl border px-4 py-5 text-left transition sm:min-h-[11.5rem] ${
                canOfferPt
                  ? "border-[#FF7E00]/40 bg-[#FF7E00]/10 hover:border-[#FF7E00]/55"
                  : "cursor-not-allowed border-white/[0.06] bg-[#0E1016]/40 opacity-45"
              }`}
            >
              <p className="text-xs font-bold tracking-wide text-[#FF7E00]">Personal Training</p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-white/55">
                Sessions and programs for clients once your CPT or specialist credential is approved.
              </p>
              <div className="mt-3 min-h-[2.25rem]">
                {!canOfferPt ? (
                  <p className="text-[10px] font-semibold text-rose-300/90">
                    {selectedPtPath
                      ? "Awaiting approved training credential (CPT or specialist)"
                      : "Training path not selected"}
                  </p>
                ) : null}
              </div>
            </button>
          </div>
          <button type="button" onClick={() => resetFlow()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Cancel
          </button>
        </div>
      ) : null}

      {screen === "service" && offeringKind ? (
        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">Choose a Match Fit Template</p>
          <p className="text-center text-xs text-white/45">You can set a custom public title on the next step.</p>
          <div className="grid max-h-[min(28rem,55vh)] auto-rows-fr gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {serviceCatalogForKind.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickService(s.id)}
                className="flex h-full min-h-[4.75rem] flex-col justify-center rounded-xl border border-white/[0.08] bg-[#0E1016]/60 px-4 py-3 text-left text-sm text-white/85 transition hover:border-[#FF7E00]/40 hover:bg-[#FF7E00]/08"
              >
                <span className="font-semibold text-white">{s.label}</span>
                <span className="mt-1 block text-[11px] text-white/45">
                  {s.virtual && s.inPerson ? "Virtual or In-Person" : s.virtual ? "Virtual on Match Fit" : "In-Person"}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => resetFlow()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            BACK
          </button>
        </div>
      ) : null}

      {screen === "delivery" && serviceId ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">How Will This Be Delivered?</p>
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
            BACK
          </button>
        </div>
      ) : null}

      {screen === "details" && serviceId && delivery && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">
            {editingServiceId ? "Edit Package" : "Package Details"}
          </p>
            <p className="text-center text-xs text-white/45">
            <span className="font-semibold uppercase tracking-wide text-white/40">Template</span>:{" "}
            {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
            {editingServiceId ? (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-[#FF7E00]/80">
                Published — changes go live after you save
              </span>
            ) : null}
          </p>

          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <div>
              <label className={labelClass}>Public title (optional)</label>
              <input
                className={`${inputClass} mt-1.5`}
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
                placeholder={MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label ?? "Your package name"}
                maxLength={TRAINER_SERVICE_PUBLIC_TITLE_MAX}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Shown on your profile and in the market price check. Leave blank to use the template name shown above.
              </p>
            </div>
            <div>
              <label className={labelClass}>Price (USD)</label>
              <input
                className={`${inputClass} mt-1.5`}
                inputMode="decimal"
                value={priceUsd}
                onChange={(e) => setPriceUsd(sanitizeTrainerServicePriceUsdTyping(e.target.value))}
                onBlur={() => {
                  const n = parseTrainerServicePriceUsdInput(priceUsd);
                  if (n != null) setPriceUsd(formatTrainerServicePriceUsd(n));
                }}
                placeholder="0.00"
              />
              <p className="mt-1 text-[10px] text-white/35">Digits and one decimal only; formatted on blur (e.g. 85 → $85.00).</p>
              {variations.length > 0 ? (
                <p className="mt-1 text-[10px] text-amber-200/75">
                  With package options below, the saved list price is the lowest-priced checkout row (Review uses that floor).
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>How you bill</label>
              <select
                className={`${inputClass} mt-1.5`}
                value={billingUnit}
                onChange={(e) => setBillingUnit(e.target.value as BillingUnit)}
              >
                {billingUnitOptions.map((u) => (
                  <option key={u} value={u}>
                    {BILLING_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{needsSessionLength ? "Session length (required)" : "Session length (optional)"}</label>
              <input
                className={`${inputClass} mt-1.5`}
                inputMode="numeric"
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(e.target.value.replace(/\D/g, ""))}
                placeholder="Minutes (e.g. 60)"
              />
            </div>
            <div>
              <label className={labelClass}>Session frequency</label>
              <select
                className={`${inputClass} mt-1.5`}
                value={sessionFrequencyKind}
                onChange={(e) => {
                  const v = e.target.value as SessionFrequencyKind;
                  setSessionFrequencyKind(v);
                  setSessionFrequencyCount("");
                  setSessionFrequencyCustom("");
                }}
              >
                <option value="per_week">PER WEEK</option>
                <option value="per_month">PER MONTH</option>
                <option value="custom">CUSTOMIZED FREQUENCY</option>
                <option value="none">NO SET FREQUENCY</option>
              </select>
            </div>
            {sessionFrequencyKind === "per_week" || sessionFrequencyKind === "per_month" ? (
              <div>
                <label className={labelClass}>
                  {sessionFrequencyKind === "per_week" ? "Sessions per week" : "Sessions per month"}
                </label>
                <input
                  className={`${inputClass} mt-1.5`}
                  inputMode="numeric"
                  value={sessionFrequencyCount}
                  onChange={(e) => setSessionFrequencyCount(e.target.value.replace(/\D/g, ""))}
                  placeholder={sessionFrequencyKind === "per_week" ? "1–14" : "1–31"}
                />
              </div>
            ) : null}
            {sessionFrequencyKind === "custom" ? (
              <div>
                <label className={labelClass}>Describe cadence</label>
                <textarea
                  className={`${inputClass} mt-1.5 min-h-[4.5rem] resize-y`}
                  value={sessionFrequencyCustom}
                  onChange={(e) => setSessionFrequencyCustom(e.target.value.slice(0, 120))}
                  placeholder="e.g. Every other week, or 2× monthly video check-ins"
                  maxLength={120}
                />
                <p className="mt-1 text-[10px] text-white/35">{sessionFrequencyCustom.trim().length}/120</p>
              </div>
            ) : null}
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
                  <label className={labelClass}>Max drive distance (miles)</label>
                  <input
                    className={`${inputClass} mt-1.5`}
                    inputMode="numeric"
                    value={inPersonRadiusMiles}
                    onChange={(e) => setInPersonRadiusMiles(e.target.value)}
                    placeholder="e.g. 15"
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

            <div className="border-t border-white/[0.08] pt-4">
              <p className={labelClass}>Package options (optional)</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Add rows clients pick at checkout (e.g. 45 vs 60 minutes) and optional bundle tiers. One template can list every
                variation—no duplicate services.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!serviceId || busy}
                  onClick={() => {
                    if (!serviceId) return;
                    setVariations(templateVariationsForService(serviceId));
                  }}
                  className="rounded-lg border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/90 transition hover:border-[#FF7E00]/55 disabled:opacity-40"
                >
                  Insert template options
                </button>
                {variations.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setVariations([])}
                    className="rounded-lg border border-white/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/55 transition hover:border-white/25"
                  >
                    Clear options
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !serviceId}
                  onClick={() => {
                    if (!serviceId) return;
                    setVariations((prev) => [
                      ...prev,
                      {
                        variationId: newVariationId(),
                        label: "New option",
                        priceUsd: 85,
                        billingUnit: matchServiceAllowsMultiSessionBilling(serviceId) ? billingUnit : "per_session",
                        sessionMinutes:
                          needsSessionLength && !serviceOfferingIsDiyTemplate(serviceId) ? 60 : undefined,
                        bundleTiers: [],
                      },
                    ]);
                  }}
                  className="rounded-lg border border-white/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/55 transition hover:border-white/25"
                >
                  Add empty option
                </button>
              </div>

              {variations.map((v, vi) => (
                <div key={v.variationId} className="mt-4 space-y-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <label className={labelClass}>Option label</label>
                      <input
                        className={`${inputClass} mt-1.5`}
                        value={v.label}
                        onChange={(e) => {
                          setVariations((prev) =>
                            prev.map((row, i) => (i === vi ? { ...row, label: e.target.value } : row))
                          );
                        }}
                        placeholder="e.g. 60-minute sessions"
                        maxLength={80}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setVariations((prev) => prev.filter((_, i) => i !== vi))}
                      className="shrink-0 rounded-lg border border-rose-400/25 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-200/90 hover:border-rose-400/45"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Price (USD)</label>
                      <input
                        type="number"
                        min={15}
                        max={5000}
                        step={1}
                        className={`${inputClass} mt-1.5`}
                        value={Number.isFinite(v.priceUsd) ? v.priceUsd : ""}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setVariations((prev) =>
                            prev.map((row, i) =>
                              i === vi ? { ...row, priceUsd: Number.isFinite(n) ? n : row.priceUsd } : row,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Billing</label>
                      <select
                        className={`${inputClass} mt-1.5`}
                        value={v.billingUnit}
                        onChange={(e) =>
                          setVariations((prev) =>
                            prev.map((row, i) =>
                              i === vi ? { ...row, billingUnit: e.target.value as BillingUnit } : row,
                            ),
                          )
                        }
                      >
                        {billingUnitOptions.map((u) => (
                          <option key={u} value={u}>
                            {BILLING_UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {needsSessionLength && !serviceOfferingIsDiyTemplate(serviceId) ? (
                    <div>
                      <label className={labelClass}>Session length (minutes)</label>
                      <input
                        className={`${inputClass} mt-1.5`}
                        inputMode="numeric"
                        value={v.sessionMinutes ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const n = raw === "" ? undefined : Number(raw);
                          setVariations((prev) =>
                            prev.map((row, i) =>
                              i === vi ? { ...row, sessionMinutes: n == null || !Number.isFinite(n) ? undefined : n } : row,
                            ),
                          );
                        }}
                        placeholder="e.g. 60"
                      />
                    </div>
                  ) : null}

                  <div className="border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Bundle tiers (optional)</p>
                    <p className="mt-0.5 text-[10px] text-white/32">Larger session counts at a total package price (checkout shows one row per tier).</p>
                    {(v.bundleTiers ?? []).map((t, ti) => (
                      <div
                        key={t.tierId}
                        className="mt-2 grid gap-2 rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-2 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-semibold uppercase text-white/35">Qty</label>
                          <input
                            type="number"
                            min={2}
                            max={52}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  const tiers = [...(row.bundleTiers ?? [])];
                                  const cur = tiers[ti];
                                  if (!cur) return row;
                                  tiers[ti] = { ...cur, quantity: Number.isFinite(n) ? Math.floor(n) : cur.quantity };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[9px] font-semibold uppercase text-white/35">Total $</label>
                          <input
                            type="number"
                            min={15}
                            max={50000}
                            step={1}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.priceUsd}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  const tiers = [...(row.bundleTiers ?? [])];
                                  const cur = tiers[ti];
                                  if (!cur) return row;
                                  tiers[ti] = { ...cur, priceUsd: Number.isFinite(n) ? n : cur.priceUsd };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[9px] font-semibold uppercase text-white/35">Label (optional)</label>
                          <input
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.label ?? ""}
                            onChange={(e) => {
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  const tiers = [...(row.bundleTiers ?? [])];
                                  const cur = tiers[ti];
                                  if (!cur) return row;
                                  tiers[ti] = { ...cur, label: e.target.value };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                            placeholder="4-pack"
                            maxLength={80}
                          />
                        </div>
                        <div className="flex items-end sm:col-span-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  return {
                                    ...row,
                                    bundleTiers: (row.bundleTiers ?? []).filter((bt) => bt.tierId !== t.tierId),
                                  };
                                }),
                              );
                            }}
                            className="w-full rounded border border-white/10 py-2 text-[10px] font-bold uppercase text-white/50 hover:border-rose-400/35 hover:text-rose-200/90"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setVariations((prev) =>
                          prev.map((row, i) => {
                            if (i !== vi) return row;
                            const q = 4;
                            const nextPrice = Math.max(15, Math.round(row.priceUsd * q * 0.92 * 100) / 100);
                            const tier: TrainerServiceOfferingBundleTier = {
                              tierId: newBundleTierId(),
                              quantity: q,
                              priceUsd: nextPrice,
                              label: `${q}-pack`,
                            };
                            return { ...row, bundleTiers: [...(row.bundleTiers ?? []), tier] };
                          }),
                        )
                      }
                      className="mt-2 rounded-lg border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:border-[#FF7E00]/35"
                    >
                      + Add bundle tier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0E1016]/40 px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7E00]"
              checked={priceCheckAiEnabled}
              onChange={(e) => setPriceCheckAiEnabled(e.target.checked)}
            />
            <span className="text-left text-[11px] leading-relaxed text-white/60">
              <span className="font-bold text-white/85">AI pricing suggestions</span>
              {" — "}
              When on, Review can use OpenAI (if configured) with benchmarks. When off, only benchmarks run—no AI recommendation on what to
              change.
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void openPriceCheckModal()}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45"
            >
              {busy ? "Working…" : "REVIEW"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (editingServiceId ? resetFlow() : setScreen("delivery"))}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-sm font-black uppercase tracking-[0.08em] text-white/80 hover:border-white/20 disabled:opacity-45"
            >
              {editingServiceId ? "CANCEL" : "BACK"}
            </button>
          </div>
        </div>
      ) : null}

      {priceModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-check-title"
        >
          <div className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#12151C] p-5 shadow-2xl sm:p-6">
            <h3 id="price-check-title" className="text-center text-sm font-bold tracking-wide text-[#FF7E00]">
              Market Price Check
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-white/45">
              Estimates use Match Fit benchmarks and, when configured, an AI pass. This is guidance only—not tax or legal
              advice.
            </p>

            {priceModal.loading ? (
              <p className="mt-8 text-center text-sm text-white/60">Analyzing your package…</p>
            ) : priceModal.result ? (
              <div className="mt-5 space-y-3 rounded-xl border border-white/[0.08] bg-[#0E1016]/70 p-4 text-sm text-white/85">
                <p
                  className={`text-center text-[13px] font-bold ${
                    priceModal.result.verdict === "too_high"
                      ? "text-amber-200"
                      : priceModal.result.verdict === "too_low"
                        ? "text-sky-200"
                        : "text-emerald-200"
                  }`}
                >
                  {priceModal.result.headline}
                </p>
                <p className="text-xs leading-relaxed text-white/60">{priceModal.result.detail}</p>
                {priceModal.result.aiDisabled ? (
                  <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    AI review off — benchmarks only
                  </p>
                ) : null}
                <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-center text-xs text-white/55">
                  <span className="text-white/40">Typical band: </span>
                  {formatTrainerServicePriceUsd(priceModal.result.benchmarkLowUsd)}–
                  {formatTrainerServicePriceUsd(priceModal.result.benchmarkHighUsd)} ·{" "}
                  <span className="text-white/40">Suggested: </span>
                  <span className="font-bold text-[#FF7E00]">
                    {formatTrainerServicePriceUsd(priceModal.result.suggestedPriceUsd)}
                  </span>
                  {priceModal.result.source === "openai" ? (
                    <span className="ml-1 text-[10px] uppercase text-white/35">AI-assisted</span>
                  ) : null}
                </div>
                <p className="text-center text-xs text-white/45">
                  {variations.length > 0 ? "Lowest option list price: " : "Your entered price: "}
                  <span className="font-semibold text-white">
                    {(() => {
                      const tentative = buildTentativeOfferingLine();
                      const p =
                        variations.length > 0 && tentative
                          ? minListPriceUsdOnLine(tentative)
                          : parsePriceUsdField();
                      return p != null ? formatTrainerServicePriceUsd(p) : "—";
                    })()}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              {!priceModal.loading && priceModal.result ? (
                <>
                  <button
                    type="button"
                    disabled={busy || priceModalBusy || variations.length > 0}
                    onClick={() => {
                      const s = priceModal.result!.suggestedPriceUsd;
                      setPriceUsd(formatTrainerServicePriceUsd(s));
                      void executePublish(s);
                    }}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/50 bg-[#FF7E00]/18 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/65 disabled:opacity-45"
                  >
                    Use suggested {formatTrainerServicePriceUsd(priceModal.result.suggestedPriceUsd)}
                  </button>
                  <button
                    type="button"
                    disabled={busy || priceModalBusy || (variations.length === 0 && parsePriceUsdField() == null)}
                    onClick={() => {
                      const tentative = buildTentativeOfferingLine();
                      const p =
                        variations.length > 0 && tentative
                          ? minListPriceUsdOnLine(tentative)
                          : parsePriceUsdField();
                      if (p != null) void executePublish(p);
                    }}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-xs font-bold uppercase tracking-wide text-white/90 hover:border-white/25 disabled:opacity-45"
                  >
                    Keep my{" "}
                    {(() => {
                      const tentative = buildTentativeOfferingLine();
                      const p =
                        variations.length > 0 && tentative
                          ? minListPriceUsdOnLine(tentative)
                          : parsePriceUsdField();
                      return p != null ? formatTrainerServicePriceUsd(p) : "price";
                    })()}
                  </button>
                  <button
                    type="button"
                    disabled={busy || priceModalBusy || variations.length > 0}
                    onClick={() => void onModalAutoGeneratePrice()}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/12 bg-transparent text-xs font-semibold uppercase tracking-wide text-white/70 hover:border-white/20 disabled:opacity-45"
                  >
                    {priceModalBusy ? "Generating…" : "Auto-generate from market"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  priceModalCancelledRef.current = true;
                  setPriceModal(null);
                }}
                className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/60 disabled:opacity-30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
