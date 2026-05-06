"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BILLING_UNIT_LABELS,
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  MATCH_SERVICE_IDS_PT_OFFERING,
  billingUnitIsCadencePackBase,
  serviceOfferingIsDiyTemplate,
  serviceOfferingNeedsSessionLength,
  wizardSelectableBillingUnits,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
} from "@/lib/trainer-match-questionnaire";
import { parseTrainerMatchQuestionnaireDraft } from "@/lib/trainer-match-questionnaire-draft";
import type { PriceCheckResult } from "@/lib/trainer-offering-price-suggest";
import { roundPriceToStep } from "@/lib/trainer-offering-price-suggest";
import {
  bundleTierQuantityUnitPhrase,
  bundleTierPriceFromMainOfferingLine,
  bundleTierSuggestLabel,
  clampTrainerServiceSessionMinutes,
  computeBundleTierTotalFromDiscount,
  defaultTrainerServiceOfferingsDocument,
  effectiveClientBookingAvailability,
  effectiveSiteVisibility,
  mergeServiceOfferingFrequencyFields,
  minListPriceUsdOnLine,
  resolvedTrainerServicePublicTitle,
  TRAINER_SERVICE_PUBLIC_TITLE_MAX,
  TRAINER_SERVICE_SESSION_MINUTES_MAX,
  TRAINER_SERVICE_SESSION_MINUTES_MIN,
  variationRequiresSessionCount,
  type ServiceOfferingFrequencyDto,
  type TrainerServiceOfferingAddOn,
  type TrainerServiceOfferingBundleTier,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingVariation,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { serviceAddOnPresetOptions as presetsForServiceAddOns } from "@/lib/trainer-service-add-on-presets";
import {
  templateVariationsForService,
  variationCheckoutSetupSummary,
  variationRowFromBaseMetrics,
} from "@/lib/trainer-service-variation-presets";
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

/** Field labels above inputs — source Title Case; `uppercase` styles them for scanability. */
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

function selectableBilling(serviceId: MatchServiceId | null): BillingUnit[] {
  return serviceId ? wizardSelectableBillingUnits(serviceId) : ["per_session", "per_hour"];
}

function bundleTierLabelPlaceholder(bu: BillingUnit): string {
  if (bu === "per_week") return "e.g. 8 weeks";
  if (bu === "twice_weekly") return "e.g. 4 blocks";
  if (bu === "per_month") return "e.g. 3 months";
  if (bu === "per_hour") return "e.g. 10 hours";
  if (bu === "per_person") return "e.g. 6-session pack";
  return "8-pack";
}

function bundleVolumesHelpSentence(billingUnit: BillingUnit): string {
  if (billingUnitIsCadencePackBase(billingUnit)) {
    return "Add tiers so clients save when they prepay for multiple weeks or months at your listed cadence. Totals multiply your list rate by how many periods are in the tier.";
  }
  if (billingUnit === "per_hour") {
    return "Add tiers so clients save when they prepay for more hours. Math uses your list price and billing above.";
  }
  return "Add tiers so clients save when they prepay for more sessions. Math uses your list price and billing above.";
}

type ServicesWizardDraft = {
  id: string;
  savedAtIso: string;
  label: string;
  snapshot: Record<string, unknown>;
};

const SERVICES_WIZARD_DRAFT_KEY = "matchfit_services_wizard_drafts_v1";
const SERVICE_WIZARD_SNAPSHOT_VERSION = 1;

function readStoredDrafts(): ServicesWizardDraft[] {
  try {
    const raw = localStorage.getItem(SERVICES_WIZARD_DRAFT_KEY);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? (j as ServicesWizardDraft[]).filter((x) => x && typeof x.id === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredDrafts(rows: ServicesWizardDraft[]) {
  localStorage.setItem(SERVICES_WIZARD_DRAFT_KEY, JSON.stringify(rows));
}

function catalogTemplateLabel(serviceId: MatchServiceId): string {
  return MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label ?? serviceId;
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

  type ServiceWizardScreen =
    | "home"
    | "category"
    | "service"
    | "packageBase"
    | "baseOfferings"
    | "copyDetails"
    | "aiReview";
  const [screen, setScreen] = useState<ServiceWizardScreen>("home");
  const [offeringKind, setOfferingKind] = useState<OfferingKind | null>(null);
  const [serviceId, setServiceId] = useState<MatchServiceId | null>(null);
  const [delivery, setDelivery] = useState<ServiceDeliveryMode | null>(null);

  const [priceUsd, setPriceUsd] = useState("");
  const [billingUnit, setBillingUnit] = useState<BillingUnit>("per_session");
  const [description, setDescription] = useState("");
  const [publicTitle, setPublicTitle] = useState("");
  const [inPersonZip, setInPersonZip] = useState("");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState("");
  const [variations, setVariations] = useState<TrainerServiceOfferingVariation[]>([]);
  const [baseSessionMinutes, setBaseSessionMinutes] = useState("");
  const [optionalAddOnsSelected, setOptionalAddOnsSelected] = useState<TrainerServiceOfferingAddOn[]>([]);
  const [mainBundleTiers, setMainBundleTiers] = useState<TrainerServiceOfferingBundleTier[]>([]);
  const [variationPriceUsdText, setVariationPriceUsdText] = useState<Record<string, string>>({});
  const [variationSessionMinutesText, setVariationSessionMinutesText] = useState<Record<string, string>>({});
  const [addOnPriceUsdText, setAddOnPriceUsdText] = useState<Record<string, string>>({});
  const [portalMounted, setPortalMounted] = useState(false);
  const [setupCancelOpen, setSetupCancelOpen] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<ServicesWizardDraft[]>([]);

  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ profilePath: string; label: string } | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<MatchServiceId | null>(null);
  const [priceModal, setPriceModal] = useState<null | { loading: boolean; result?: PriceCheckResult & { aiDisabled?: boolean } }>(
    null,
  );
  const priceModalCancelledRef = useRef(false);
  const [listingReviewOpen, setListingReviewOpen] = useState(false);
  const [aiRecChecked, setAiRecChecked] = useState<Record<string, boolean>>({});

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

  const billingUnitOptions = useMemo(() => selectableBilling(serviceId), [serviceId]);
  const variationBillingOptions = billingUnitOptions;

  const needsSessionLength = Boolean(
    serviceId && delivery && serviceOfferingNeedsSessionLength(serviceId, delivery),
  );

  const optionalAddOnPresets = useMemo(
    () => (serviceId ? presetsForServiceAddOns(serviceId) : []),
    [serviceId],
  );

  useEffect(() => {
    if (!serviceId) return;
    const allowed = selectableBilling(serviceId);
    setBillingUnit((prev) => (allowed.includes(prev) ? prev : allowed[0]!));
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    const row = MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId);
    if (!row?.inPerson || row.virtual) return;
    setDelivery((prev) => (prev === "virtual" || prev === "both" ? "in_person" : prev));
  }, [serviceId]);

  useEffect(() => {
    setPortalMounted(typeof document !== "undefined");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSavedDrafts(readStoredDrafts());
  }, [screen]);

  useEffect(() => {
    setVariationPriceUsdText((prev) => {
      const next = { ...prev };
      for (const v of variations) {
        if (next[v.variationId] === undefined) {
          next[v.variationId] = Number.isFinite(v.priceUsd) ? formatTrainerServicePriceUsd(v.priceUsd) : "";
        }
      }
      for (const k of Object.keys(next)) {
        if (!variations.some((x) => x.variationId === k)) delete next[k];
      }
      return next;
    });
  }, [variations]);

  useEffect(() => {
    setVariationSessionMinutesText((prev) => {
      const next = { ...prev };
      for (const v of variations) {
        if (next[v.variationId] === undefined) {
          next[v.variationId] =
            v.sessionMinutes != null && Number.isFinite(v.sessionMinutes)
              ? String(Math.floor(v.sessionMinutes))
              : "";
        }
      }
      for (const k of Object.keys(next)) {
        if (!variations.some((x) => x.variationId === k)) delete next[k];
      }
      return next;
    });
  }, [variations]);

  useEffect(() => {
    setAddOnPriceUsdText((prev) => {
      const next = { ...prev };
      for (const a of optionalAddOnsSelected) {
        if (next[a.addonId] === undefined && a.priceUsd != null && Number.isFinite(a.priceUsd)) {
          next[a.addonId] = formatTrainerServicePriceUsd(a.priceUsd);
        }
      }
      for (const k of Object.keys(next)) {
        if (!optionalAddOnsSelected.some((x) => x.addonId === k)) delete next[k];
      }
      return next;
    });
  }, [optionalAddOnsSelected]);

  function resetFlow() {
    setScreen("home");
    setOfferingKind(null);
    setServiceId(null);
    setDelivery(null);
    setEditingServiceId(null);
    setPriceUsd("");
    setBillingUnit("per_session");
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
    setMainBundleTiers([]);
    setVariationPriceUsdText({});
    setAddOnPriceUsdText({});
    setBaseSessionMinutes("");
    setOptionalAddOnsSelected([]);
    setListingReviewOpen(false);
    setAiRecChecked({});
    setSetupCancelOpen(false);
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

  useEffect(() => {
    if (priceModal?.loading === false && priceModal.result?.recommendations?.length) {
      const next: Record<string, boolean> = {};
      for (const rec of priceModal.result.recommendations) {
        next[rec.id] = true;
      }
      setAiRecChecked(next);
    }
  }, [priceModal]);

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
    setScreen("packageBase");
  }

  function normalizeVariationRow(
    v: TrainerServiceOfferingVariation,
    effectiveServiceId: MatchServiceId | null = serviceId,
  ): TrainerServiceOfferingVariation {
    const buClean = v.billingUnit === "multi_session" ? "per_session" : v.billingUnit;
    let bu: BillingUnit = buClean;
    if (effectiveServiceId) {
      const allowed = wizardSelectableBillingUnits(effectiveServiceId);
      bu = allowed.includes(buClean) ? buClean : allowed[0]!;
    }
    let next: TrainerServiceOfferingVariation = { ...v, billingUnit: bu };
    if (!effectiveServiceId) return next;
    /** One session unit per checkout row; pack sizes use bundle tiers (or checkout quantity). */
    if (variationRequiresSessionCount(effectiveServiceId, next.billingUnit)) {
      return { ...next, sessionCount: 1 };
    }
    const { sessionCount: _sc, ...rest } = next;
    return rest as TrainerServiceOfferingVariation;
  }

  /** Stable labels + trimmed copy for API / price math. */
  function normalizedVariationsForApi(): TrainerServiceOfferingVariation[] | undefined {
    if (!serviceId || variations.length === 0) return undefined;
    const clampLen = Boolean(delivery && serviceOfferingNeedsSessionLength(serviceId, delivery));
    return variations.map((v, i) => {
      let next = normalizeVariationRow(
        {
          ...v,
          label: v.label.trim() || catalogTemplateLabel(serviceId),
          variationDescription: v.variationDescription?.trim()
            ? v.variationDescription.trim().slice(0, 400)
            : undefined,
        },
        serviceId,
      );
      if (clampLen) {
        const t = variationSessionMinutesText[next.variationId];
        const raw = (
          t !== undefined ? t : next.sessionMinutes != null ? String(Math.floor(next.sessionMinutes)) : ""
        ).trim();
        if (raw === "") {
          next = { ...next, sessionMinutes: undefined };
        } else {
          const n = Number(raw);
          if (Number.isFinite(n)) {
            next = { ...next, sessionMinutes: clampTrainerServiceSessionMinutes(n) };
          }
        }
      }
      const tiers = next.bundleTiers;
      if (tiers && tiers.length > 0) {
        next = {
          ...next,
          bundleTiers: tiers.map((t) => ({
            ...t,
            label: t.label?.trim() || undefined,
            discountPercent:
              t.discountPercent != null && Number.isFinite(t.discountPercent)
                ? Math.min(90, Math.max(0, Math.round(t.discountPercent)))
                : undefined,
          })),
        };
      } else {
        const { bundleTiers: _b, ...rest } = next;
        next = rest as TrainerServiceOfferingVariation;
      }
      return next;
    });
  }

  function bundleTierPriceFromRow(v: TrainerServiceOfferingVariation, tier: TrainerServiceOfferingBundleTier): number {
    const pct = tier.discountPercent ?? 0;
    const baseUnits = billingUnitIsCadencePackBase(v.billingUnit) ? 1 : Math.max(1, v.sessionCount ?? 1);
    return computeBundleTierTotalFromDiscount({
      billingUnit: v.billingUnit,
      basePriceUsd: v.priceUsd,
      baseUnitCount: baseUnits,
      tierQuantity: tier.quantity,
      discountPercent: pct,
    });
  }

  function parseMainSessionMinutesField(): number | undefined {
    if (!serviceId || !delivery) return undefined;
    if (!serviceOfferingNeedsSessionLength(serviceId, delivery)) return undefined;
    const raw = baseSessionMinutes.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return clampTrainerServiceSessionMinutes(n);
  }

  function addVariationFromBaseMetrics() {
    if (!serviceId || !delivery) return;
    setFormErr(null);
    const n = parsePriceUsdField();
    if (n == null || n < 15 || n > 5000) {
      setFormErr("Enter a valid list price ($15–$5,000) before adding a variation.");
      return;
    }
    const row = variationRowFromBaseMetrics({
      serviceId,
      delivery,
      priceUsd: n,
      billingUnit,
      rowIndex: variations.length,
      sessionMinutesOverride: parseMainSessionMinutesField(),
    });
    setMainBundleTiers([]);
    setVariations((prev) => [...prev, normalizeVariationRow(row, serviceId)]);
  }

  function parsePriceUsdField(): number | null {
    const n = parseTrainerServicePriceUsdInput(priceUsd);
    if (n == null || !Number.isFinite(n)) return null;
    return n;
  }

  type ServiceWizardSnapshot = Record<string, unknown>;

  function isMatchServiceSid(x: unknown): x is MatchServiceId {
    return typeof x === "string" && MATCH_SERVICE_CATALOG.some((s) => s.id === x);
  }

  function isServiceDeliveryMode(x: unknown): x is ServiceDeliveryMode {
    return x === "virtual" || x === "in_person" || x === "both";
  }

  function isOfferingKindVal(x: unknown): x is OfferingKind {
    return x === "nutrition" || x === "personal_training";
  }

  function isWizardScreenVal(x: unknown): x is ServiceWizardScreen {
    return (
      x === "home" ||
      x === "category" ||
      x === "service" ||
      x === "packageBase" ||
      x === "baseOfferings" ||
      x === "copyDetails" ||
      x === "aiReview"
    );
  }

  function collectWizardSnapshot(): ServiceWizardSnapshot {
    return {
      v: SERVICE_WIZARD_SNAPSHOT_VERSION,
      screen,
      offeringKind,
      serviceId,
      delivery,
      priceUsd,
      billingUnit,
      description,
      publicTitle,
      inPersonZip,
      inPersonRadiusMiles,
      variations,
      mainBundleTiers,
      baseSessionMinutes,
      optionalAddOns: optionalAddOnsSelected,
    };
  }

  function applyWizardSnapshot(raw: ServiceWizardSnapshot): boolean {
    if (Number(raw.v) !== SERVICE_WIZARD_SNAPSHOT_VERSION) return false;
    if (!isWizardScreenVal(raw.screen)) return false;
    if (raw.offeringKind != null && !isOfferingKindVal(raw.offeringKind)) return false;
    const sid = raw.serviceId;
    if (sid != null && !isMatchServiceSid(sid)) return false;
    const del = raw.delivery;
    if (del != null && !isServiceDeliveryMode(del)) return false;

    setScreen(raw.screen);
    setOfferingKind((raw.offeringKind as OfferingKind | null) ?? null);
    setServiceId(sid ?? null);
    setDelivery(del ?? null);
    setPriceUsd(typeof raw.priceUsd === "string" ? raw.priceUsd : "");
    const allowedBu = sid ? wizardSelectableBillingUnits(sid) : (["per_session", "per_hour"] as BillingUnit[]);
    const buRaw = raw.billingUnit;
    if (typeof buRaw === "string" && allowedBu.includes(buRaw as BillingUnit)) {
      setBillingUnit(buRaw as BillingUnit);
    } else setBillingUnit(allowedBu[0]!);
    setDescription(typeof raw.description === "string" ? raw.description : "");
    setPublicTitle(typeof raw.publicTitle === "string" ? raw.publicTitle : "");
    setInPersonZip(typeof raw.inPersonZip === "string" ? raw.inPersonZip : "");
    setInPersonRadiusMiles(typeof raw.inPersonRadiusMiles === "string" ? raw.inPersonRadiusMiles : "");

    const resumeSid = sid ?? null;
    if (Array.isArray(raw.variations) && resumeSid) {
      setVariations(
        (raw.variations as TrainerServiceOfferingVariation[])
          .filter((row) => row && typeof row === "object")
          .map((v) => normalizeVariationRow(v as TrainerServiceOfferingVariation, resumeSid)),
      );
    } else setVariations([]);

    if (Array.isArray(raw.mainBundleTiers)) {
      setMainBundleTiers(
        (raw.mainBundleTiers as TrainerServiceOfferingBundleTier[]).filter((t) => t && typeof t.tierId === "string"),
      );
    } else setMainBundleTiers([]);

    setBaseSessionMinutes(typeof raw.baseSessionMinutes === "string" ? raw.baseSessionMinutes : "");

    const addRaw = raw.optionalAddOns;
    if (Array.isArray(addRaw)) {
      setOptionalAddOnsSelected(
        addRaw.filter((a) => a && typeof (a as TrainerServiceOfferingAddOn).addonId === "string") as TrainerServiceOfferingAddOn[],
      );
    } else setOptionalAddOnsSelected([]);

    setFormErr(null);
    setListingReviewOpen(false);
    setPriceModal(null);
    return true;
  }

  function saveDraftAndExit() {
    const snapshot = collectWizardSnapshot();
    const label =
      screen === "category"
        ? "New service · draft"
        : serviceId
          ? `${MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label ?? "Service"} · draft`
          : "Service · draft";
    const id = globalThis.crypto?.randomUUID?.() ?? `d_${Date.now()}`;
    const next: ServicesWizardDraft[] = [{ id, savedAtIso: new Date().toISOString(), label, snapshot }, ...readStoredDrafts()].slice(
      0,
      20,
    );
    writeStoredDrafts(next);
    setSavedDrafts(next);
    setSetupCancelOpen(false);
    resetFlow();
  }

  function deleteDraftById(draftId: string) {
    const next = readStoredDrafts().filter((d) => d.id !== draftId);
    writeStoredDrafts(next);
    setSavedDrafts(next);
  }

  function resumeDraft(draftId: string) {
    const row = readStoredDrafts().find((d) => d.id === draftId);
    if (!row) return;
    const ok = applyWizardSnapshot(row.snapshot as ServiceWizardSnapshot);
    if (!ok) {
      setFormErr("That draft could not be loaded (it may be from an older version).");
      return;
    }
    setEditingServiceId(null);
    setSuccess(null);
    setFormErr(null);
    setSetupCancelOpen(false);
  }

  function requestSetupExit() {
    if (editingServiceId) {
      resetFlow();
      return;
    }
    if (screen === "home") return;
    setSetupCancelOpen(true);
  }

  function discardSetupExit() {
    setSetupCancelOpen(false);
    resetFlow();
  }

  async function patchPublishedServiceVisibility(
    lineServiceId: MatchServiceId,
    patch: { siteVisibility?: "visible" | "hidden"; clientBookingAvailability?: "available" | "unavailable" },
  ) {
    setFormErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/trainer/dashboard/services/${encodeURIComponent(lineServiceId)}/visibility`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setFormErr(await readApiErrorMessage(res, "Could not update visibility."));
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleOptionalAddOnFromPreset(preset: { addonId: string; label: string; description?: string }) {
    setOptionalAddOnsSelected((prev) => {
      const i = prev.findIndex((a) => a.addonId === preset.addonId);
      if (i >= 0) {
        const id = prev[i]!.addonId;
        setAddOnPriceUsdText((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        return prev.filter((_, j) => j !== i);
      }
      const row: TrainerServiceOfferingAddOn = {
        addonId: preset.addonId,
        label: preset.label,
        coachSummary: "",
        priceUsd: 25,
        billingUnit: "per_session",
        ...(preset.description ? { description: preset.description } : {}),
      };
      setAddOnPriceUsdText((p) => ({ ...p, [preset.addonId]: formatTrainerServicePriceUsd(25) }));
      return [...prev, row];
    });
  }

  function patchOptionalAddOn(addonId: string, patch: Partial<TrainerServiceOfferingAddOn>) {
    setOptionalAddOnsSelected((prev) => prev.map((a) => (a.addonId === addonId ? { ...a, ...patch } : a)));
  }

  function removeOptionalAddOn(addonId: string) {
    setOptionalAddOnsSelected((prev) => prev.filter((a) => a.addonId !== addonId));
    setAddOnPriceUsdText((p) => {
      const next = { ...p };
      delete next[addonId];
      return next;
    });
  }

  /** Fields shared by market price-check requests (benchmark + OpenAI). */
  function priceCheckListingPayload(): Record<string, unknown> {
    if (!delivery) return {};
    const out: Record<string, unknown> = { sessionFrequencyKind: "none" };
    if (delivery === "in_person" || delivery === "both") {
      const zip = inPersonZip.trim();
      if (zip) out.inPersonZip = zip;
      const r = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);
      if (r != null && Number.isFinite(r) && r >= 1 && r <= 150) {
        out.inPersonRadiusMiles = Math.floor(r);
      }
    }
    if (variations.length > 0) {
      out.variations = normalizedVariationsForApi() ?? variations;
    }
    return out;
  }

  function buildFrequencyBody(): ServiceOfferingFrequencyDto {
    return { sessionFrequencyKind: "none" };
  }

  function buildTentativeOfferingLine(): TrainerServiceOfferingLine | null {
    if (!serviceId || !delivery) return null;
    const pub = publicTitle.trim();
    const desc = description.trim();
    const anchor = parsePriceUsdField();
    const vApi = normalizedVariationsForApi();
    const line: TrainerServiceOfferingLine = {
      serviceId,
      delivery,
      billingUnit,
      priceUsd: anchor != null && anchor >= 15 && anchor <= 5000 ? anchor : 100,
      description: desc.length >= 20 ? desc : "xxxxxxxxxxxxxxxxxxxx",
      sessionMinutes: undefined,
    };
    mergeServiceOfferingFrequencyFields(line, buildFrequencyBody());
    if (pub) line.publicTitle = pub;
    const mainM = parseMainSessionMinutesField();
    if (variations.length === 0 && mainM != null) {
      line.sessionMinutes = mainM;
    }
    if (optionalAddOnsSelected.length > 0) {
      line.optionalAddOns = optionalAddOnsSelected;
    }
    if (vApi && vApi.length > 0) {
      line.variations = vApi;
      delete line.bundleTiers;
      line.priceUsd = minListPriceUsdOnLine(line);
    } else {
      delete line.variations;
      if (mainBundleTiers.length > 0) line.bundleTiers = mainBundleTiers;
      else delete line.bundleTiers;
    }
    return line;
  }

  function validatePackageBase(): string | null {
    if (!offeringKind || !serviceId) return "Choose a template first.";
    if (!delivery) return "Choose how this package is delivered.";
    if (publicTitle.trim().length > TRAINER_SERVICE_PUBLIC_TITLE_MAX) {
      return `Public title must be ${TRAINER_SERVICE_PUBLIC_TITLE_MAX} characters or fewer.`;
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

  function validateCopyDetails(): string | null {
    if (description.trim().length < 20) {
      return "Add a client-facing description (at least 20 characters) on the copy step.";
    }
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i]!;
      const vd = v.variationDescription?.trim();
      if (vd && vd.length > 400) {
        return `Option ${i + 1}: shorten the extra description (400 characters max).`;
      }
    }
    return null;
  }

  function validateBaseOfferingsStep(priceOverride?: number): string | null {
    if (!serviceId || !delivery) return "Complete package details first.";
    if (variations.length > 0) {
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]!;
        if (v.priceUsd < 15 || v.priceUsd > 5000) return `Option ${i + 1}: price must be between $15 and $5,000.`;
        if (!selectableBilling(serviceId).includes(v.billingUnit)) {
          return `Option ${i + 1}: pick a billing option that matches this template.`;
        }
        if (needsSessionLength) {
          const raw =
            Object.hasOwn(variationSessionMinutesText, v.variationId) === true
              ? (variationSessionMinutesText[v.variationId] ?? "").trim()
              : v.sessionMinutes != null && Number.isFinite(v.sessionMinutes)
                ? String(Math.floor(v.sessionMinutes))
                : "";
          if (raw === "") {
            return `Option ${i + 1}: enter session length (${TRAINER_SERVICE_SESSION_MINUTES_MIN}–${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes) for this template.`;
          }
          const n = Number(raw);
          const int = Math.floor(n);
          if (
            !Number.isFinite(n) ||
            int < TRAINER_SERVICE_SESSION_MINUTES_MIN ||
            int > TRAINER_SERVICE_SESSION_MINUTES_MAX
          ) {
            return `Option ${i + 1}: session length must be between ${TRAINER_SERVICE_SESSION_MINUTES_MIN} and ${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes.`;
          }
        }
      }
      const tentative = buildTentativeOfferingLine();
      const listMin = tentative ? minListPriceUsdOnLine(tentative) : null;
      if (listMin == null || !Number.isFinite(listMin)) return "Fix option prices before continuing.";
      const price = priceOverride ?? listMin;
      if (price < 15 || price > 5000) return "Lowest option price must stay between $15 and $5,000.";
    } else {
      if (!selectableBilling(serviceId).includes(billingUnit)) {
        return "Pick a billing option that matches this template.";
      }
      const price = priceOverride ?? parsePriceUsdField();
      if (price == null || price < 15) return "Enter a valid price in USD (minimum $15).";
      if (price > 5000) return "Maximum list price is $5,000.";
      if (needsSessionLength) {
        const mainRaw = baseSessionMinutes.trim();
        if (mainRaw === "") {
          return `Enter session length for your main offering (${TRAINER_SERVICE_SESSION_MINUTES_MIN}–${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes), or add variations.`;
        }
        const mn = Number(mainRaw);
        const mint = Math.floor(mn);
        if (
          !Number.isFinite(mn) ||
          mint < TRAINER_SERVICE_SESSION_MINUTES_MIN ||
          mint > TRAINER_SERVICE_SESSION_MINUTES_MAX
        ) {
          return `Enter session length for your main offering (${TRAINER_SERVICE_SESSION_MINUTES_MIN}–${TRAINER_SERVICE_SESSION_MINUTES_MAX} minutes), or add variations.`;
        }
      }
    }
    return null;
  }

  function validateOptionalAddOnsStep(): string | null {
    for (let i = 0; i < optionalAddOnsSelected.length; i++) {
      const a = optionalAddOnsSelected[i]!;
      if (!a.label.trim()) return `Add-on ${i + 1}: enter a client-visible title.`;
      if (a.priceUsd == null || !Number.isFinite(a.priceUsd) || a.priceUsd < 15 || a.priceUsd > 5000) {
        return `Add-on ${i + 1}: price must be between $15 and $5,000.`;
      }
      if (a.billingUnit !== "per_session" && a.billingUnit !== "per_hour") {
        return `Add-on ${i + 1}: choose how this add-on is billed.`;
      }
    }
    return null;
  }

  function validateBundlesStep(): string | null {
    if (!serviceId || !delivery) return null;
    if (variations.length === 0) {
      for (let j = 0; j < mainBundleTiers.length; j++) {
        const t = mainBundleTiers[j]!;
        if (!Number.isFinite(t.quantity) || t.quantity < 2 || t.quantity > 52) {
          return `Main bundle ${j + 1}: quantity must be between 2 and 52.`;
        }
        if (!Number.isFinite(t.priceUsd) || t.priceUsd < 15 || t.priceUsd > 50_000) {
          return `Main bundle ${j + 1}: total price must be between $15 and $50,000.`;
        }
      }
    }
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i]!;
      const tiers = v.bundleTiers ?? [];
      for (let j = 0; j < tiers.length; j++) {
        const t = tiers[j]!;
        if (!Number.isFinite(t.quantity) || t.quantity < 2 || t.quantity > 52) {
          return `Option ${i + 1}, bundle ${j + 1}: quantity must be between 2 and 52.`;
        }
        if (!Number.isFinite(t.priceUsd) || t.priceUsd < 15 || t.priceUsd > 50_000) {
          return `Option ${i + 1}, bundle ${j + 1}: total price must be between $15 and $50,000.`;
        }
      }
    }
    return null;
  }

  function validateDetails(priceOverride?: number): string | null {
    return (
      validatePackageBase() ??
      validateBaseOfferingsStep(priceOverride) ??
      validateBundlesStep() ??
      validateCopyDetails() ??
      validateOptionalAddOnsStep()
    );
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
    const needsZip = delivery === "in_person" || delivery === "both";
    const zip = inPersonZip.trim();
    const radius = inPersonRadiusMiles.trim() === "" ? undefined : Number(inPersonRadiusMiles);

    const freqBody = buildFrequencyBody();
    const vSave = normalizedVariationsForApi();

    const isEdit = editingServiceId != null;
    const pub = publicTitle.trim();
    const mainM = parseMainSessionMinutesField();
    const baseBody = {
      priceUsd: effectiveListPrice,
      billingUnit,
      description: description.trim(),
      sessionMinutes: variations.length === 0 && mainM != null ? mainM : undefined,
      delivery,
      inPersonZip: needsZip ? zip : undefined,
      inPersonRadiusMiles: needsZip ? radius : undefined,
      ...freqBody,
    };
    const addOnPublish = optionalAddOnsSelected.length > 0 ? { optionalAddOns: optionalAddOnsSelected } : {};
    const addOnPatch = { optionalAddOns: optionalAddOnsSelected };

    setBusy(true);
    try {
      const patchBody = {
        ...baseBody,
        publicTitle: pub,
        variations: variations.length > 0 && vSave ? vSave : [],
        bundleTiers: variations.length === 0 ? mainBundleTiers : [],
        ...addOnPatch,
      };
      const publishBody = {
        offeringKind,
        serviceId,
        ...baseBody,
        ...(pub ? { publicTitle: pub } : {}),
        ...(vSave && vSave.length > 0 ? { variations: vSave } : {}),
        ...(variations.length === 0 && mainBundleTiers.length > 0 ? { bundleTiers: mainBundleTiers } : {}),
        ...addOnPublish,
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

  function applySuggestedAnchorPriceUsd(suggestedRaw: number) {
    const suggested = roundPriceToStep(suggestedRaw);
    const tentative = buildTentativeOfferingLine();
    const curMin = tentative ? minListPriceUsdOnLine(tentative) : parsePriceUsdField();
    if (curMin == null || !Number.isFinite(curMin) || curMin <= 0) {
      setPriceUsd(formatTrainerServicePriceUsd(Math.min(5000, Math.max(15, suggested))));
      return;
    }
    const factor = suggested / curMin;
    if (variations.length === 0) {
      setPriceUsd(formatTrainerServicePriceUsd(Math.min(5000, Math.max(15, suggested))));
      return;
    }
    setVariations((prev) =>
      prev.map((v) => {
        const nextPrice = roundPriceToStep(Math.min(5000, Math.max(15, v.priceUsd * factor)));
        const tiers = v.bundleTiers?.map((t) => ({
          ...t,
          priceUsd: roundPriceToStep(Math.min(50_000, Math.max(15, t.priceUsd * factor))),
        }));
        return { ...v, priceUsd: nextPrice, bundleTiers: tiers };
      }),
    );
  }

  function handleAiModalKeepOriginal() {
    setPriceModal(null);
  }

  function handleAiModalApplyChanges(applyAll: boolean) {
    const r = priceModal?.result;
    if (!r?.recommendations?.length) {
      setPriceModal(null);
      return;
    }
    if (applyAll) {
      const all: Record<string, boolean> = {};
      for (const rec of r.recommendations) {
        all[rec.id] = true;
      }
      setAiRecChecked(all);
    }
    const targets = applyAll
      ? r.recommendations.filter((x) => x.applyKind === "use_suggested_anchor")
      : r.recommendations.filter((x) => x.applyKind === "use_suggested_anchor" && aiRecChecked[x.id]);
    if (targets.length > 0) {
      applySuggestedAnchorPriceUsd(r.suggestedPriceUsd);
    }
    setPriceModal(null);
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
    const allowedMain = wizardSelectableBillingUnits(line.serviceId);
    setBillingUnit(allowedMain.includes(line.billingUnit) ? line.billingUnit : allowedMain[0]!);
    setDescription(line.description ?? "");
    setPublicTitle(line.publicTitle ?? "");
    setOptionalAddOnsSelected(
      (line.optionalAddOns ?? [])
        .filter((x) => x.label.trim())
        .map((a) => ({
          ...a,
          coachSummary: a.coachSummary ?? "",
          priceUsd: a.priceUsd != null && Number.isFinite(a.priceUsd) ? a.priceUsd : 25,
          billingUnit: a.billingUnit === "per_hour" ? ("per_hour" as const) : ("per_session" as const),
        })),
    );
    const foldLegacyLineSessionIntoVariation =
      (!line.variations || line.variations.length === 0) &&
      serviceOfferingNeedsSessionLength(line.serviceId, line.delivery) &&
      !serviceOfferingIsDiyTemplate(line.serviceId) &&
      line.sessionMinutes != null;

    if (line.variations && line.variations.length > 0) {
      setMainBundleTiers([]);
      setBaseSessionMinutes("");
      setVariations(
        line.variations.map((v) => normalizeVariationRow({ ...v }, line.serviceId)),
      );
    } else if (foldLegacyLineSessionIntoVariation) {
      const labelSeed =
        line.publicTitle?.trim() ||
        MATCH_SERVICE_CATALOG.find((s) => s.id === line.serviceId)?.label ||
        "Option 1";
      const allowedLine = wizardSelectableBillingUnits(line.serviceId);
      const bu = allowedLine.includes(line.billingUnit) ? line.billingUnit : allowedLine[0]!;
      setVariations([
        normalizeVariationRow(
          {
            variationId: newVariationId(),
            label: labelSeed,
            sessionMinutes: line.sessionMinutes!,
            priceUsd: line.priceUsd,
            billingUnit: bu,
            ...(variationRequiresSessionCount(line.serviceId, bu) ? { sessionCount: 1 } : {}),
          },
          line.serviceId,
        ),
      ]);
      setBaseSessionMinutes("");
      setMainBundleTiers([]);
    } else {
      setVariations([]);
      setMainBundleTiers(line.bundleTiers ?? []);
      setBaseSessionMinutes(
        line.sessionMinutes != null && line.sessionMinutes > 0 ? String(line.sessionMinutes) : "",
      );
    }
    const o = offeringsDoc ?? defaultTrainerServiceOfferingsDocument();
    setInPersonZip((o.inPersonServiceZip ?? draft.inPersonZip ?? "").trim());
    setInPersonRadiusMiles(
      o.inPersonServiceRadiusMiles != null
        ? String(o.inPersonServiceRadiusMiles)
        : draft.inPersonRadiusMiles != null
          ? String(draft.inPersonRadiusMiles)
          : "",
    );
    setScreen("packageBase");
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
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services & Pricing</h2>
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
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services & Pricing</h2>
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
    <section className="relative isolate z-20 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <div className="text-center">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Services & Pricing</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/55">
          Set up what you sell, how it&apos;s delivered, and what clients should expect, all from your dashboard.
          Published offerings appear on your public profile right away.
        </p>
      </div>

      {success ? (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-sm font-semibold text-emerald-100/95">“{success.label}” is live</p>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            We sent a notification with a link to your profile. Clients can see this service under services and rates.
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
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">On Your Profile Now</p>
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
                        <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                          <label className="flex items-center gap-2 text-[10px] text-white/45">
                            <span className="font-semibold uppercase tracking-wide text-white/35">Profile</span>
                            <select
                              disabled={busy}
                              value={effectiveSiteVisibility(line)}
                              onChange={(e) =>
                                void patchPublishedServiceVisibility(line.serviceId, {
                                  siteVisibility: e.target.value as "visible" | "hidden",
                                })
                              }
                              className="rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1 text-[11px] text-white outline-none"
                            >
                              <option value="visible">Visible</option>
                              <option value="hidden">Hidden</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-2 text-[10px] text-white/45">
                            <span className="font-semibold uppercase tracking-wide text-white/35">Purchases</span>
                            <select
                              disabled={busy}
                              value={effectiveClientBookingAvailability(line)}
                              onChange={(e) =>
                                void patchPublishedServiceVisibility(line.serviceId, {
                                  clientBookingAvailability: e.target.value as "available" | "unavailable",
                                })
                              }
                              className="rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1 text-[11px] text-white outline-none"
                            >
                              <option value="available">Available</option>
                              <option value="unavailable">Unavailable</option>
                            </select>
                          </label>
                        </div>
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
              The onboarding questionnaire only stores session format preferences and your in-person matching radius. Packages, prices,
              and delivery for what you sell are managed here. Your public profile pulls from this list.
            </p>
          </div>

          {savedDrafts.length > 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Saved Drafts</p>
              <ul className="mt-3 space-y-2">
                {savedDrafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[#12151C]/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{d.label}</p>
                      <p className="mt-0.5 text-[10px] text-white/35">
                        {new Date(d.savedAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resumeDraft(d.id)}
                        className="rounded-lg border border-[#FF7E00]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/90 hover:border-[#FF7E00]/55 disabled:opacity-45"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteDraftById(d.id)}
                        className="rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55 hover:border-white/25 disabled:opacity-45"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => startAddFlow()}
              className="inline-flex min-h-[3rem] w-full max-w-sm items-center justify-center rounded-2xl border border-[#FF7E00]/45 bg-[#FF7E00]/14 px-6 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#FF7E00]/60 hover:bg-[#FF7E00]/22"
            >
              Add a New Service
            </button>
            <p className="text-center text-xs text-white/40">
              To change match preferences (session formats, radius), use daily questionnaires in the navigation.
            </p>
          </div>
        </div>
      ) : null}

      {screen === "category" ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">What kind of offering is this?</p>
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
          <button type="button" onClick={() => requestSetupExit()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Cancel
          </button>
        </div>
      ) : null}

      {screen === "service" && offeringKind ? (
        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          <p className="text-center text-sm font-semibold text-white/85">Choose a Match Fit template</p>
          <p className="text-center text-xs text-white/45">
            Optional public title in step 1; per-row titles (if you add checkout options) are on each card in step 2.
          </p>
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
                  {s.virtual && s.inPerson ? "Virtual or in-person" : s.virtual ? "Virtual on Match Fit" : "In-person"}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => requestSetupExit()} className="w-full text-center text-xs text-white/45 hover:text-white/70">
            Back
          </button>
        </div>
      ) : null}

      {screen === "packageBase" && serviceId && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Step 1 of 4 · Main Package Details</p>
          <p className="text-center text-sm font-semibold text-white/85">
            {editingServiceId ? "Edit Package — Shared Details" : "Main Package Details"}
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
          <p className="text-center text-[11px] leading-relaxed text-white/38">
            Delivery, optional title, and service area apply to this package. Client-facing copy is added in step 3.
          </p>

          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <div>
              <p className={labelClass}>Method of Delivery</p>
              {deliveryOptions.length === 0 ? (
                <p className="mt-2 text-sm text-rose-300/90">This service template is not available on Match Fit.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {deliveryOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDelivery(opt.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        delivery === opt.id
                          ? "border-[#FF7E00]/55 bg-[#FF7E00]/12"
                          : "border-white/[0.08] bg-[#0E1016]/60 hover:border-[#FF7E00]/45"
                      }`}
                    >
                      <p className="text-sm font-bold text-white">{opt.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/50">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Public Title (Optional)</label>
              <input
                className={`${inputClass} mt-1.5`}
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
                placeholder={MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label ?? "Your package name"}
                maxLength={TRAINER_SERVICE_PUBLIC_TITLE_MAX}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Shown on your profile and in the step 4 AI listing check. Leave blank to use the template name shown above.
              </p>
            </div>

            {delivery && (delivery === "in_person" || delivery === "both") ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>In-Person Center ZIP</label>
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={inPersonZip}
                    onChange={(e) => setInPersonZip(e.target.value)}
                    placeholder="30301"
                  />
                </div>
                <div>
                  <label className={labelClass}>Max Drive Distance (Miles)</label>
                  <input
                    className={`${inputClass} mt-1.5`}
                    inputMode="numeric"
                    value={inPersonRadiusMiles}
                    onChange={(e) => setInPersonRadiusMiles(e.target.value)}
                    placeholder="e.g. 15"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormErr(null);
                const err = validatePackageBase();
                if (err) {
                  setFormErr(err);
                  return;
                }
                setScreen("baseOfferings");
              }}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45"
            >
              Continue to Base Offerings
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (editingServiceId ? resetFlow() : setScreen("service"))}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-sm font-black uppercase tracking-[0.08em] text-white/80 hover:border-white/20 disabled:opacity-45"
            >
              {editingServiceId ? "Cancel" : "Back"}
            </button>
          </div>
          {!editingServiceId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => requestSetupExit()}
              className="w-full pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55 disabled:opacity-45"
            >
              Exit setup
            </button>
          ) : null}
        </div>
      ) : null}

      {screen === "baseOfferings" && serviceId && delivery && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Step 2 of 4 · Service Offerings</p>
          <p className="text-center text-sm font-semibold text-white/85">Price, Billing & Checkout Options</p>
          <p className="text-center text-xs text-white/45">
            <span className="font-semibold uppercase tracking-wide text-white/40">Template</span>:{" "}
            {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
            {editingServiceId ? (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-[#FF7E00]/80">
                Published — changes go live after you save
              </span>
            ) : null}
          </p>
          <p className="text-center text-[11px] leading-relaxed text-white/38">
            Set up your main offering with <span className="font-semibold text-white/55">list price</span> and{" "}
            <span className="font-semibold text-white/55">how it&apos;s billed</span>. Session length below applies when you publish one
            price with no extra rows and seeds each new checkout option. Bundles live in each option card—or under the single-price setup.
            Step 3 is client-facing copy.
          </p>

          <div className="space-y-3">
            <details open className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
                <span className="text-[#FF7E00]">▸</span> Service Offering Setup
              </summary>
              <div className="mt-3 space-y-4">
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
                  <p className="mt-1 text-[10px] text-white/35">Use digits and one decimal; formatted on blur.</p>
                </div>
                <div>
                  <label className={labelClass}>How You Bill</label>
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
                {needsSessionLength ? (
                  <div>
                    <label className={labelClass}>
                      Session Length — Main Offering (Minutes, {TRAINER_SERVICE_SESSION_MINUTES_MIN}–
                      {TRAINER_SERVICE_SESSION_MINUTES_MAX})
                    </label>
                    <input
                      className={`${inputClass} mt-1.5`}
                      inputMode="numeric"
                      value={baseSessionMinutes}
                      onChange={(e) => setBaseSessionMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      onBlur={() => {
                        const raw = baseSessionMinutes.trim();
                        if (raw === "") return;
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return;
                        setBaseSessionMinutes(String(clampTrainerServiceSessionMinutes(n)));
                      }}
                      placeholder="e.g. 60"
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      Required when you only publish one price. Also used as the default length when you add a new row below.
                    </p>
                  </div>
                ) : null}
                <p className="text-[10px] leading-relaxed text-white/38">
                  Prefer multiple checkout rows? Add each option below—each opens its own card with optional volume bundles. Single list
                  price? Configure bundle tiers here.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy || !serviceId || !delivery}
                    onClick={() => addVariationFromBaseMetrics()}
                    className="w-full rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 py-3 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/58 disabled:opacity-40"
                  >
                    Add Variation
                  </button>
                  <button
                    type="button"
                    disabled={!serviceId || busy}
                    onClick={() => {
                      if (!serviceId) return;
                      if (
                        variations.length > 0 &&
                        !globalThis.confirm("Replace your current checkout rows with catalog starters for this template?")
                      )
                        return;
                      const next = templateVariationsForService(serviceId).map((v) => normalizeVariationRow({ ...v }, serviceId));
                      setMainBundleTiers([]);
                      setVariations(next);
                    }}
                    className="w-full rounded-xl border border-white/14 bg-white/[0.06] py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/95 transition hover:border-[#FF7E00]/40 disabled:opacity-40"
                  >
                    Catalog Presets (Optional)
                  </button>
                </div>
                {variations.length === 0 ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <p className="text-[11px] font-bold text-white/80">Bundle Pricing (Optional)</p>
                    <p className="text-[10px] leading-relaxed text-white/40">{bundleVolumesHelpSentence(billingUnit)}</p>
                    {mainBundleTiers.length === 0 ? (
                      <p className="text-xs text-white/45">
                        Skip this if you only sell one at a time; clients can still buy multiples at checkout.
                      </p>
                    ) : null}
                    {mainBundleTiers.map((t, ti) => (
                      <div
                        key={t.tierId}
                        className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-2 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-semibold uppercase text-white/35">Qty</label>
                          <input
                            type="number"
                            min={2}
                            max={52}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.quantity}
                            onChange={(e) => {
                              const num = Number(e.target.value);
                              setMainBundleTiers((prev) => {
                                const anchor = parsePriceUsdField();
                                const tiers = [...prev];
                                const cur = tiers[ti];
                                if (!cur) return prev;
                                const qty = Number.isFinite(num) ? Math.min(52, Math.max(2, Math.floor(num))) : cur.quantity;
                                const nextT = { ...cur, quantity: qty };
                                const px =
                                  anchor != null && cur.discountPercent != null && Number.isFinite(cur.discountPercent)
                                    ? bundleTierPriceFromMainOfferingLine({
                                        billingUnit,
                                        basePriceUsd: anchor,
                                        tierQuantity: qty,
                                        discountPercent: cur.discountPercent,
                                      })
                                    : cur.priceUsd;
                                tiers[ti] = { ...nextT, priceUsd: px };
                                return tiers;
                              });
                            }}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-semibold text-white/35">Discount %</label>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.discountPercent ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nPct = raw === "" ? undefined : Number(raw);
                              setMainBundleTiers((prev) => {
                                const anchor = parsePriceUsdField();
                                const tiers = [...prev];
                                const cur = tiers[ti];
                                if (!cur) return prev;
                                const pct =
                                  nPct != null && Number.isFinite(nPct)
                                    ? Math.min(90, Math.max(0, Math.floor(nPct)))
                                    : undefined;
                                const px =
                                  anchor != null && pct != null
                                    ? bundleTierPriceFromMainOfferingLine({
                                        billingUnit,
                                        basePriceUsd: anchor,
                                        tierQuantity: cur.quantity,
                                        discountPercent: pct,
                                      })
                                    : cur.priceUsd;
                                tiers[ti] = { ...cur, discountPercent: pct, priceUsd: px };
                                return tiers;
                              });
                            }}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-semibold text-white/35">Total ($)</label>
                          <input
                            type="number"
                            min={15}
                            max={50000}
                            step={1}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.priceUsd}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setMainBundleTiers((prev) => {
                                const tiers = [...prev];
                                const cur = tiers[ti];
                                if (!cur) return prev;
                                tiers[ti] = {
                                  ...cur,
                                  priceUsd: Number.isFinite(n) ? n : cur.priceUsd,
                                  discountPercent: undefined,
                                };
                                return tiers;
                              });
                            }}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[9px] font-semibold text-white/35">Label (optional)</label>
                          <input
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.label ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMainBundleTiers((prev) => {
                                const tiers = [...prev];
                                const cur = tiers[ti];
                                if (!cur) return prev;
                                tiers[ti] = { ...cur, label: v };
                                return tiers;
                              });
                            }}
                            placeholder={bundleTierLabelPlaceholder(billingUnit)}
                            maxLength={80}
                          />
                        </div>
                        <div className="flex items-end sm:col-span-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setMainBundleTiers((prev) => prev.filter((bt) => bt.tierId !== t.tierId))}
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
                      onClick={() => {
                        const n = parsePriceUsdField();
                        if (n == null || n < 15) {
                          setFormErr("Set a valid main list price ($15+) before adding bundle tiers.");
                          return;
                        }
                        const q = 4;
                        const tier: TrainerServiceOfferingBundleTier = {
                          tierId: newBundleTierId(),
                          quantity: q,
                          priceUsd: 0,
                          label: bundleTierSuggestLabel(q, billingUnit),
                          discountPercent: 8,
                        };
                        tier.priceUsd = bundleTierPriceFromMainOfferingLine({
                          billingUnit,
                          basePriceUsd: n,
                          tierQuantity: q,
                          discountPercent: 8,
                        });
                        setMainBundleTiers((prev) => [...prev, tier]);
                      }}
                      className="rounded-lg border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:border-[#FF7E00]/35"
                    >
                      + Add Bundle Tier
                    </button>
                  </div>
                ) : null}
              </div>
            </details>

            {variations.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setVariations([])}
                  className="rounded-lg border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/55 transition hover:border-white/25"
                >
                  Clear All Variations
                </button>
              </div>
            ) : null}

              {variations.map((v, vi) => (
                <details key={v.variationId} open className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="text-[#FF7E00]">▸</span> Checkout Option {vi + 1}
                      {serviceId && delivery ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-white/40">
                          {variationCheckoutSetupSummary(serviceId, delivery, v)}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[10px] font-normal text-white/32">
                        Optional title and row description are below; a blank title uses the catalog template name.
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.preventDefault();
                        setVariations((prev) => prev.filter((_, i) => i !== vi));
                      }}
                      className="shrink-0 rounded-lg border border-rose-400/25 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-200/90 hover:border-rose-400/45"
                    >
                      Remove
                    </button>
                  </summary>
                  <div className="mt-3 space-y-4">
                    <div>
                      <label className={labelClass}>Price (USD)</label>
                      <input
                        className={`${inputClass} mt-1.5`}
                        inputMode="decimal"
                        value={variationPriceUsdText[v.variationId] ?? ""}
                        onChange={(e) => {
                          const t = sanitizeTrainerServicePriceUsdTyping(e.target.value);
                          setVariationPriceUsdText((p) => ({ ...p, [v.variationId]: t }));
                          const n = parseTrainerServicePriceUsdInput(t);
                          if (n != null && n >= 15 && n <= 5000) {
                            setVariations((prev) => prev.map((row, i) => (i === vi ? { ...row, priceUsd: n } : row)));
                          }
                        }}
                        onBlur={() => {
                          const raw = variationPriceUsdText[v.variationId] ?? "";
                          const n = parseTrainerServicePriceUsdInput(raw);
                          setVariations((prev) =>
                            prev.map((row, i) =>
                              i === vi
                                ? {
                                    ...row,
                                    priceUsd:
                                      n != null && n >= 15 && n <= 5000 ? n : row.priceUsd,
                                  }
                                : row,
                            ),
                          );
                          setVariationPriceUsdText((p) => ({
                            ...p,
                            [v.variationId]:
                              n != null
                                ? formatTrainerServicePriceUsd(Math.min(5000, Math.max(15, n)))
                                : Number.isFinite(v.priceUsd)
                                  ? formatTrainerServicePriceUsd(v.priceUsd)
                                  : "",
                          }));
                        }}
                        placeholder="0.00"
                      />
                      <p className="mt-1 text-[10px] text-white/35">Use digits and one decimal; formatted on blur.</p>
                    </div>
                    <div>
                      <label className={labelClass}>How You Bill</label>
                      <select
                        className={`${inputClass} mt-1.5`}
                        value={v.billingUnit}
                        onChange={(e) => {
                          const bu = e.target.value as BillingUnit;
                          setVariations((prev) =>
                            prev.map((row, i) => {
                              if (i !== vi) return row;
                              if (!serviceId) return { ...row, billingUnit: bu };
                              return normalizeVariationRow({ ...row, billingUnit: bu }, serviceId);
                            }),
                          );
                        }}
                      >
                        {variationBillingOptions.map((u) => (
                          <option key={u} value={u}>
                            {BILLING_UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {needsSessionLength ? (
                      <div>
                        <label className={labelClass}>
                          Session Length — This Option (Minutes, {TRAINER_SERVICE_SESSION_MINUTES_MIN}–
                          {TRAINER_SERVICE_SESSION_MINUTES_MAX})
                        </label>
                        <input
                          className={`${inputClass} mt-1.5`}
                          inputMode="numeric"
                          value={
                            variationSessionMinutesText[v.variationId] !== undefined
                              ? variationSessionMinutesText[v.variationId]!
                              : v.sessionMinutes != null && Number.isFinite(v.sessionMinutes)
                                ? String(Math.floor(v.sessionMinutes))
                                : ""
                          }
                          onChange={(e) => {
                            const t = e.target.value.replace(/\D/g, "").slice(0, 3);
                            setVariationSessionMinutesText((p) => ({ ...p, [v.variationId]: t }));
                          }}
                          onBlur={() => {
                            const raw = (variationSessionMinutesText[v.variationId] ?? "").trim();
                            if (raw === "") {
                              setVariations((prev) =>
                                prev.map((row, i) =>
                                  i === vi ? { ...row, sessionMinutes: undefined } : row,
                                ),
                              );
                              setVariationSessionMinutesText((p) => ({ ...p, [v.variationId]: "" }));
                              return;
                            }
                            const n = Number(raw);
                            const clamped = Number.isFinite(n) ? clampTrainerServiceSessionMinutes(n) : undefined;
                            setVariations((prev) =>
                              prev.map((row, i) =>
                                i === vi ? { ...row, sessionMinutes: clamped } : row,
                              ),
                            );
                            setVariationSessionMinutesText((p) => ({
                              ...p,
                              [v.variationId]: clamped != null ? String(clamped) : "",
                            }));
                          }}
                          placeholder="e.g. 60"
                        />
                        <p className="mt-1 text-[10px] text-white/35">
                          Required on this template for each checkout row.
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <label className={labelClass}>Checkout Title (Optional)</label>
                      <input
                        className={`${inputClass} mt-1.5`}
                        value={v.label}
                        onChange={(e) =>
                          setVariations((prev) =>
                            prev.map((row, i) => (i === vi ? { ...row, label: e.target.value.slice(0, 80) } : row)),
                          )
                        }
                        maxLength={80}
                        placeholder={catalogTemplateLabel(serviceId)}
                      />
                      <p className="mt-1 text-[10px] text-white/35">
                        Leave blank to use <span className="text-white/55">{catalogTemplateLabel(serviceId)}</span> for this option at checkout.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Extra Description for This Option (Optional)</label>
                      <textarea
                        className={`${inputClass} mt-1.5 min-h-[4rem] resize-y`}
                        value={v.variationDescription ?? ""}
                        onChange={(e) => {
                          setVariations((prev) =>
                            prev.map((row, i) =>
                              i === vi ? { ...row, variationDescription: e.target.value.slice(0, 400) } : row,
                            ),
                          );
                        }}
                        placeholder="Add client-facing specifics for this checkout choice."
                        maxLength={400}
                      />
                      <p className="mt-1 text-[10px] text-white/35">{(v.variationDescription ?? "").trim().length}/400</p>
                    </div>
                    <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-black/25 p-3">
                      <p className="text-[11px] font-bold text-white/80">Bundle Pricing (Optional)</p>
                      <p className="text-[10px] leading-relaxed text-white/40">
                        Each row is one billable unit at your chosen cadence. {bundleVolumesHelpSentence(v.billingUnit)} Or skip
                        tiers—clients can still pick quantity at checkout when it applies.
                      </p>
                      {(v.bundleTiers ?? []).map((t, ti) => (
                      <div
                        key={t.tierId}
                        className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-2 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-2">
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
                                  const qty = Number.isFinite(n) ? Math.min(52, Math.max(2, Math.floor(n))) : cur.quantity;
                                  const nextT = { ...cur, quantity: qty };
                                  const priceUsd =
                                    cur.discountPercent != null && Number.isFinite(cur.discountPercent)
                                      ? bundleTierPriceFromRow(row, { ...nextT, discountPercent: cur.discountPercent })
                                      : cur.priceUsd;
                                  tiers[ti] = { ...nextT, priceUsd };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-semibold text-white/35">Discount %</label>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            className={`${inputClass} mt-1 py-2 text-sm`}
                            value={t.discountPercent ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = raw === "" ? undefined : Number(raw);
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  const tiers = [...(row.bundleTiers ?? [])];
                                  const cur = tiers[ti];
                                  if (!cur) return row;
                                  const pct =
                                    n != null && Number.isFinite(n) ? Math.min(90, Math.max(0, Math.floor(n))) : undefined;
                                  const nextT = { ...cur, discountPercent: pct };
                                  const priceUsd =
                                    pct != null ? bundleTierPriceFromRow(row, { ...nextT, discountPercent: pct }) : cur.priceUsd;
                                  tiers[ti] = { ...nextT, priceUsd };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-semibold text-white/35">Total ($)</label>
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
                                  tiers[ti] = {
                                    ...cur,
                                    priceUsd: Number.isFinite(n) ? n : cur.priceUsd,
                                    discountPercent: undefined,
                                  };
                                  return { ...row, bundleTiers: tiers };
                                }),
                              );
                            }}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[9px] font-semibold text-white/35">Label (optional)</label>
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
                            placeholder={bundleTierLabelPlaceholder(v.billingUnit)}
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
                            const tier: TrainerServiceOfferingBundleTier = {
                              tierId: newBundleTierId(),
                              quantity: q,
                              priceUsd: 0,
                              label: bundleTierSuggestLabel(q, row.billingUnit),
                              discountPercent: 8,
                            };
                            tier.priceUsd = bundleTierPriceFromRow(row, tier);
                            return { ...row, bundleTiers: [...(row.bundleTiers ?? []), tier] };
                          }),
                        )
                      }
                      className="rounded-lg border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:border-[#FF7E00]/35"
                    >
                      + Add Bundle Tier
                    </button>
                  </div>
                  </div>
                </details>
              ))}

          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormErr(null);
                const err = validateBaseOfferingsStep();
                if (err) {
                  setFormErr(err);
                  return;
                }
                const errB = validateBundlesStep();
                if (errB) {
                  setFormErr(errB);
                  return;
                }
                setScreen("copyDetails");
              }}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45"
            >
              Continue to Copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setScreen("packageBase")}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-sm font-black uppercase tracking-[0.08em] text-white/80 hover:border-white/20 disabled:opacity-45"
            >
              Back
            </button>
          </div>
          {!editingServiceId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => requestSetupExit()}
              className="w-full pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55 disabled:opacity-45"
            >
              Exit setup
            </button>
          ) : null}
        </div>
      ) : null}

      {screen === "copyDetails" && serviceId && delivery && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Step 3 of 4 · Copy & Descriptions</p>
          <p className="text-center text-sm font-semibold text-white/85">What Clients Read</p>
          <p className="text-center text-xs text-white/45">
            <span className="font-semibold uppercase tracking-wide text-white/40">Template</span>:{" "}
            {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
          </p>
          <p className="text-center text-[11px] leading-relaxed text-white/38">
            Describe the overall package here and optionally add extras from the presets below. Checkout option titles live on each row in
            step 2.
          </p>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 p-4">
            <p className="text-[13px] font-semibold tracking-normal text-white/80">Optional Add-Ons</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/38">
              Add presets below, then customize how each one reads and prices on your profile. Billing is either per time you deliver the
              add-on or per hour.
            </p>
            {optionalAddOnPresets.some((pr) => !optionalAddOnsSelected.some((a) => a.addonId === pr.addonId)) ? (
              <div className="mt-4 space-y-2">
                <p className={labelClass}>Add From Presets</p>
                <div className="flex flex-wrap gap-2">
                  {optionalAddOnPresets.map((preset) => {
                    const on = optionalAddOnsSelected.some((a) => a.addonId === preset.addonId);
                    if (on) return null;
                    return (
                      <button
                        key={preset.addonId}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleOptionalAddOnFromPreset(preset)}
                        className="rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-[11px] font-semibold text-white/85 transition hover:border-[#FF7E00]/40 disabled:opacity-45"
                      >
                        + {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : optionalAddOnPresets.length === 0 ? (
              <p className="mt-2 text-[11px] text-white/40">Presets appear after you confirm a template in step 1.</p>
            ) : null}

            {optionalAddOnsSelected.length > 0 ? (
              <ul className="mt-5 list-none space-y-4">
                {optionalAddOnsSelected.map((a, ai) => (
                  <li
                    key={a.addonId}
                    className="rounded-2xl border border-white/[0.08] bg-black/22 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
                      <p className="text-[12px] font-bold text-[#FF7E00]/95">Add-On {ai + 1}</p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeOptionalAddOn(a.addonId)}
                        className="rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200/90 hover:border-rose-400/50"
                      >
                        Remove
                      </button>
                    </div>
                    {a.description?.trim() ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                        <span className="font-semibold text-white/60">About this extra: </span>
                        {a.description.trim()}
                      </p>
                    ) : (
                      <p className="mt-3 text-[11px] text-white/38">
                        Suggested extra for this template—edit the fields below for what clients actually see.
                      </p>
                    )}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className={labelClass}>Title Clients See</label>
                        <input
                          className={`${inputClass} mt-1.5`}
                          value={a.label}
                          disabled={busy}
                          onChange={(e) => patchOptionalAddOn(a.addonId, { label: e.target.value })}
                          placeholder="Checkout label"
                          maxLength={140}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>What Makes Your Version Unique (Optional)</label>
                        <textarea
                          className={`${inputClass} mt-1.5 min-h-[4rem] resize-y`}
                          value={a.coachSummary ?? ""}
                          disabled={busy}
                          onChange={(e) => patchOptionalAddOn(a.addonId, { coachSummary: e.target.value.slice(0, 400) })}
                          placeholder="e.g. You’ll get my private recipe database and a weekend check-in text thread."
                          maxLength={400}
                        />
                        <p className="mt-1 text-[10px] text-white/35">{(a.coachSummary ?? "").trim().length}/400</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Price (USD)</label>
                          <input
                            className={`${inputClass} mt-1.5`}
                            inputMode="decimal"
                            disabled={busy}
                            value={addOnPriceUsdText[a.addonId] ?? ""}
                            onChange={(e) => {
                              const t = sanitizeTrainerServicePriceUsdTyping(e.target.value);
                              setAddOnPriceUsdText((p) => ({ ...p, [a.addonId]: t }));
                              const n = parseTrainerServicePriceUsdInput(t);
                              if (n != null && n >= 15 && n <= 5000) {
                                patchOptionalAddOn(a.addonId, { priceUsd: n });
                              }
                            }}
                            onBlur={() => {
                              const raw = addOnPriceUsdText[a.addonId] ?? "";
                              const n = parseTrainerServicePriceUsdInput(raw);
                              const next =
                                n != null && n >= 15 && n <= 5000 ? n : a.priceUsd ?? 25;
                              patchOptionalAddOn(a.addonId, { priceUsd: next });
                              setAddOnPriceUsdText((p) => ({
                                ...p,
                                [a.addonId]: formatTrainerServicePriceUsd(next),
                              }));
                            }}
                            placeholder="0.00"
                          />
                          <p className="mt-1 text-[10px] text-white/35">Use digits and one decimal; formatted on blur.</p>
                        </div>
                        <div>
                          <label className={labelClass}>How You Bill</label>
                          <select
                            className={`${inputClass} mt-1.5`}
                            disabled={busy}
                            value={a.billingUnit ?? "per_session"}
                            onChange={(e) =>
                              patchOptionalAddOn(a.addonId, {
                                billingUnit: e.target.value as "per_session" | "per_hour",
                              })
                            }
                          >
                            <option value="per_session">Per time (each add-on)</option>
                            <option value="per_hour">Per hour</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-white/45">No add-ons yet. Use the preset buttons above to add one.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 p-4">
            <p className={labelClass}>Service Description (Required)</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/38">
              This is the main text for the whole package—what is included, who it is for, and how you support clients.
            </p>
            <textarea
              className={`${inputClass} mt-2 min-h-[7rem] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is included, who it is for, and how you support clients—at least 20 characters."
              maxLength={600}
            />
            <p className="mt-1 text-[10px] text-white/35">{description.trim().length}/600 · minimum 20 characters</p>
          </div>

          {variations.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/40 px-4 py-3 text-center text-xs leading-relaxed text-white/50">
              You&apos;re using a single list price with no checkout rows. The service description above is all clients need for copy on this
              package.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormErr(null);
                const err = validateDetails();
                if (err) {
                  setFormErr(err);
                  return;
                }
                setScreen("aiReview");
              }}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45"
            >
              Continue to Review
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setScreen("baseOfferings")}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-sm font-black uppercase tracking-[0.08em] text-white/80 hover:border-white/20 disabled:opacity-45"
            >
              Back
            </button>
          </div>
          {!editingServiceId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => requestSetupExit()}
              className="w-full pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55 disabled:opacity-45"
            >
              Exit setup
            </button>
          ) : null}
        </div>
      ) : null}

      {screen === "aiReview" && serviceId && delivery && offeringKind ? (
        <div className="mx-auto mt-8 max-w-lg space-y-4">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Step 4 of 4 · Review & Publish</p>
          <p className="text-center text-sm font-semibold text-white/85">Review & Publish</p>
          <p className="text-center text-xs text-white/45">
            <span className="font-semibold uppercase tracking-wide text-white/40">Template</span>:{" "}
            {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
          </p>
          <p className="text-center text-xs leading-relaxed text-white/50">
            Run <span className="font-semibold text-white/75">AI check</span> on your full listing (copy, prices, and options). Use{" "}
            <span className="font-semibold text-white/75">Review</span> to see and edit everything in one place before you publish—nothing
            goes live until you publish.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void openPriceCheckModal()}
              className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-45 sm:text-[11px]"
            >
              {busy ? "Working..." : "AI Check"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormErr(null);
                const err = validateDetails();
                if (err) {
                  setFormErr(err);
                  return;
                }
                setListingReviewOpen(true);
              }}
              className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-xs font-black uppercase tracking-[0.1em] text-white/90 transition hover:border-white/25 disabled:opacity-45"
            >
              Review
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormErr(null);
                const err = validateDetails();
                if (err) {
                  setFormErr(err);
                  return;
                }
                const tentative = buildTentativeOfferingLine();
                const p =
                  variations.length > 0 && tentative ? minListPriceUsdOnLine(tentative) : parsePriceUsdField();
                if (p != null && Number.isFinite(p)) void executePublish(p);
              }}
              className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-45 sm:text-[11px]"
            >
              Publish
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setScreen("copyDetails")}
            className="w-full text-center text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
          >
            Back
          </button>
          {editingServiceId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => resetFlow()}
              className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55"
            >
              Cancel edit
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => requestSetupExit()}
              className="w-full pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55"
            >
              Exit setup
            </button>
          )}
        </div>
      ) : null}

      {portalMounted && typeof document !== "undefined"
        ? createPortal(
            <>
              {setupCancelOpen ? (
                <div
                  className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="exit-setup-title"
                >
                  <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#12151C] p-6 shadow-2xl">
                    <h3 id="exit-setup-title" className="text-center text-sm font-bold text-white">
                      Exit service setup?
                    </h3>
                    <p className="mt-3 text-center text-xs leading-relaxed text-white/55">
                      Save a draft to resume later from this bubble, or discard this setup session. Published services are not changed unless
                      you finish an edit flow and save.
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSetupCancelOpen(false)}
                        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-xs font-black uppercase tracking-wide text-white disabled:opacity-45"
                      >
                        Keep editing
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveDraftAndExit()}
                        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-xs font-bold uppercase tracking-wide text-white/95 disabled:opacity-45"
                      >
                        Save draft & exit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => discardSetupExit()}
                        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-rose-400/35 bg-transparent text-xs font-bold uppercase tracking-wide text-rose-200/90 disabled:opacity-45"
                      >
                        Discard without saving
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {priceModal ? (
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-check-title"
        >
          <div className="max-h-[min(92vh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#12151C] p-5 shadow-2xl sm:p-6">
            <h3 id="price-check-title" className="text-center text-sm font-bold tracking-wide text-[#FF7E00]">
              AI Listing Check
            </h3>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-white/45">
              Guidance from Match Fit ranges and (when available) AI—not tax or legal advice.
            </p>

            {priceModal.loading ? (
              <p className="mt-8 text-center text-sm text-white/60">Checking your listing...</p>
            ) : priceModal.result ? (
              <div className="mt-5 space-y-4 rounded-xl border border-white/[0.08] bg-[#0E1016]/70 p-4 text-sm text-white/85">
                <p
                  className={`text-center text-[11px] font-black uppercase tracking-[0.14em] ${
                    priceModal.result.verdict === "too_high"
                      ? "text-amber-200"
                      : priceModal.result.verdict === "too_low"
                        ? "text-sky-200"
                        : "text-emerald-200"
                  }`}
                >
                  {priceModal.result.verdict === "too_high"
                    ? "Priced Above the Usual Range"
                    : priceModal.result.verdict === "too_low"
                      ? "Priced Below the Usual Range"
                      : "Looks in Range"}
                </p>
                <p className="text-center text-[13px] leading-snug text-white/80">
                  {priceModal.result.summaryPlain ?? priceModal.result.headline}
                </p>
                <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-center text-[11px] text-white/55">
                  <span className="text-white/40">Typical range: </span>
                  {formatTrainerServicePriceUsd(priceModal.result.benchmarkLowUsd)}–
                  {formatTrainerServicePriceUsd(priceModal.result.benchmarkHighUsd)}
                  <span className="mx-1 text-white/30">·</span>
                  <span className="text-white/40">Suggested anchor: </span>
                  <span className="font-bold text-[#FF7E00]">
                    {formatTrainerServicePriceUsd(priceModal.result.suggestedPriceUsd)}
                  </span>
                </div>
                <p className="text-center text-[11px] text-white/45">
                  {variations.length > 0 ? "Your lowest checkout price today: " : "Your list price today: "}
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
                {priceModal.result.aiDisabled ? (
                  <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Numbers Only (No AI Pass for This Request)
                  </p>
                ) : null}

                {priceModal.result.recommendations && priceModal.result.recommendations.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Suggested Changes</p>
                    <ul className="mt-2 space-y-2">
                      {priceModal.result.recommendations.map((rec) => (
                        <li key={rec.id}>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5 text-left text-[12px] leading-snug text-white/75">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7E00]"
                              checked={aiRecChecked[rec.id] ?? true}
                              onChange={(e) => {
                                setAiRecChecked((prev) => ({ ...prev, [rec.id]: e.target.checked }));
                              }}
                            />
                            <span>{rec.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[10px] leading-relaxed text-white/38">
                      Items that can auto-update your <span className="font-semibold text-white/55">prices</span> toward the suggested
                      anchor are applied when you use the orange buttons. Other lines are reminders—use{" "}
                      <span className="font-semibold text-white/55">Review</span> or the wizard steps to edit those yourself.
                    </p>
                  </div>
                ) : null}

                <details className="rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    More Detail
                  </summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/45">{priceModal.result.detail}</p>
                </details>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              {!priceModal.loading && priceModal.result ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAiModalKeepOriginal()}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-[11px] font-black uppercase tracking-[0.08em] text-white/90 transition hover:border-white/25 disabled:opacity-45"
                  >
                    Keep original
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAiModalApplyChanges(false)}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/50 bg-[#FF7E00]/18 text-[11px] font-black uppercase tracking-[0.07em] text-white transition hover:border-[#FF7E00]/65 disabled:opacity-45"
                  >
                    Make checked changes
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAiModalApplyChanges(true)}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/28 text-[11px] font-black uppercase tracking-[0.07em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-45"
                  >
                    Make all suggested changes
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
                Close
              </button>
            </div>
          </div>
        </div>
              ) : null}

              {listingReviewOpen && screen === "aiReview" && serviceId && delivery && offeringKind ? (
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-review-title"
        >
          <div className="max-h-[min(92vh,44rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#12151C] p-5 shadow-2xl sm:p-6">
            <h3 id="listing-review-title" className="text-center text-sm font-bold tracking-wide text-[#FF7E00]">
              Review Your Listing
            </h3>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-white/45">
              Nothing is published from this screen. Edit below, then close and hit <span className="font-semibold text-white/60">Publish</span>{" "}
              when you are ready.
            </p>
            <p className="mt-3 text-center text-xs text-white/50">
              <span className="font-semibold uppercase tracking-wide text-white/40">Template</span>:{" "}
              {MATCH_SERVICE_CATALOG.find((s) => s.id === serviceId)?.label}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className={labelClass}>How Clients Receive This</p>
                <div className="mt-2 space-y-2">
                  {deliveryOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDelivery(opt.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                        delivery === opt.id
                          ? "border-[#FF7E00]/55 bg-[#FF7E00]/12 text-white"
                          : "border-white/[0.08] bg-[#0E1016]/60 text-white/80 hover:border-[#FF7E00]/45"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {delivery === "in_person" || delivery === "both" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>In-Person Center ZIP</label>
                    <input className={`${inputClass} mt-1.5`} value={inPersonZip} onChange={(e) => setInPersonZip(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Max Drive Distance (Miles)</label>
                    <input
                      className={`${inputClass} mt-1.5`}
                      inputMode="numeric"
                      value={inPersonRadiusMiles}
                      onChange={(e) => setInPersonRadiusMiles(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Public Title (Optional)</label>
                <input
                  className={`${inputClass} mt-1.5`}
                  value={publicTitle}
                  onChange={(e) => setPublicTitle(e.target.value)}
                  maxLength={TRAINER_SERVICE_PUBLIC_TITLE_MAX}
                />
              </div>

              <div>
                <label className={labelClass}>Service Description</label>
                <textarea
                  className={`${inputClass} mt-1.5 min-h-[6rem] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={600}
                />
                <p className="mt-1 text-[10px] text-white/35">{description.trim().length}/600</p>
              </div>

              {variations.length === 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>List Price (USD)</label>
                    <input
                      className={`${inputClass} mt-1.5`}
                      inputMode="decimal"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(sanitizeTrainerServicePriceUsdTyping(e.target.value))}
                      onBlur={() => {
                        const n = parseTrainerServicePriceUsdInput(priceUsd);
                        if (n != null) setPriceUsd(formatTrainerServicePriceUsd(n));
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Billing</label>
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
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={labelClass}>Checkout Options</p>
                  {variations.map((v, vi) => (
                    <div key={v.variationId} className="rounded-xl border border-white/[0.08] bg-[#0E1016]/50 p-3">
                      <p className="text-[11px] font-semibold text-white/70">Checkout Option {vi + 1}</p>
                      {needsSessionLength ? (
                        <div className="mt-2">
                          <label className={labelClass}>
                            Session Length (Min, {TRAINER_SERVICE_SESSION_MINUTES_MIN}–{TRAINER_SERVICE_SESSION_MINUTES_MAX})
                          </label>
                          <input
                            className={`${inputClass} mt-1.5`}
                            inputMode="numeric"
                            value={
                              variationSessionMinutesText[v.variationId] !== undefined
                                ? variationSessionMinutesText[v.variationId]!
                                : v.sessionMinutes != null && Number.isFinite(v.sessionMinutes)
                                  ? String(Math.floor(v.sessionMinutes))
                                  : ""
                            }
                            onChange={(e) => {
                              const t = e.target.value.replace(/\D/g, "").slice(0, 3);
                              setVariationSessionMinutesText((p) => ({ ...p, [v.variationId]: t }));
                            }}
                            onBlur={() => {
                              const raw = (variationSessionMinutesText[v.variationId] ?? "").trim();
                              if (raw === "") {
                                setVariations((prev) =>
                                  prev.map((row, i) =>
                                    i === vi ? { ...row, sessionMinutes: undefined } : row,
                                  ),
                                );
                                setVariationSessionMinutesText((p) => ({ ...p, [v.variationId]: "" }));
                                return;
                              }
                              const n = Number(raw);
                              const clamped = Number.isFinite(n) ? clampTrainerServiceSessionMinutes(n) : undefined;
                              setVariations((prev) =>
                                prev.map((row, i) =>
                                  i === vi ? { ...row, sessionMinutes: clamped } : row,
                                ),
                              );
                              setVariationSessionMinutesText((p) => ({
                                ...p,
                                [v.variationId]: clamped != null ? String(clamped) : "",
                              }));
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Price (USD)</label>
                          <input
                            type="number"
                            min={15}
                            max={5000}
                            className={`${inputClass} mt-1.5`}
                            value={Number.isFinite(v.priceUsd) ? v.priceUsd : ""}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setVariations((prev) =>
                                prev.map((row, i) => (i === vi ? { ...row, priceUsd: Number.isFinite(n) ? n : row.priceUsd } : row)),
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Billing</label>
                          <select
                            className={`${inputClass} mt-1.5`}
                            value={v.billingUnit}
                            onChange={(e) => {
                              const bu = e.target.value as BillingUnit;
                              setVariations((prev) =>
                                prev.map((row, i) => {
                                  if (i !== vi) return row;
                                  if (!serviceId) return { ...row, billingUnit: bu };
                                  return normalizeVariationRow({ ...row, billingUnit: bu }, serviceId);
                                }),
                              );
                            }}
                          >
                            {variationBillingOptions.map((u) => (
                              <option key={u} value={u}>
                                {BILLING_UNIT_LABELS[u]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className={labelClass}>Checkout Title (Optional)</label>
                        <input
                          className={`${inputClass} mt-1.5`}
                          value={v.label}
                          onChange={(e) => {
                            setVariations((prev) =>
                              prev.map((row, i) => (i === vi ? { ...row, label: e.target.value.slice(0, 80) } : row)),
                            );
                          }}
                          placeholder={catalogTemplateLabel(serviceId)}
                          maxLength={80}
                        />
                        <p className="mt-1 text-[10px] text-white/35">
                          If blank, the catalog template name is used at checkout.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => setListingReviewOpen(false)}
                className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60"
              >
                Done
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setListingReviewOpen(false);
                  setScreen("packageBase");
                }}
                className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-white/75 hover:border-white/20"
              >
                Jump to Step 1
              </button>
            </div>
          </div>
        </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </section>
  );
}
