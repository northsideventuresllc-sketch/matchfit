import {
  BILLING_UNIT_LABELS,
  type BillingUnit,
  type MatchServiceId,
  type ServiceDeliveryMode,
  serviceOfferingIsDiyTemplate,
  serviceOfferingNeedsSessionLength,
} from "@/lib/trainer-match-questionnaire";
import {
  clampTrainerServiceSessionMinutes,
  variationRequiresSessionCount,
  type TrainerServiceOfferingBundleTier,
  type TrainerServiceOfferingVariation,
} from "@/lib/trainer-service-offerings";

function vid(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function tid(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return `t_${c.randomUUID().slice(0, 8)}`;
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Suggested duration / package rows when the coach clicks “Insert template options”. Prices are starting points only. */
export function templateVariationsForService(serviceId: MatchServiceId): TrainerServiceOfferingVariation[] {
  const sessionRow = (
    label: string,
    minutes: number,
    priceUsd: number,
    billing: BillingUnit = "per_session",
  ): TrainerServiceOfferingVariation => ({
    variationId: vid(),
    label,
    sessionCount: 1,
    sessionMinutes: minutes,
    priceUsd,
    billingUnit: billing,
  });

  switch (serviceId) {
    case "one_on_one_pt":
    case "sports_specific":
      return [
        sessionRow("45-minute sessions", 45, 75),
        sessionRow("60-minute sessions", 60, 95),
        sessionRow("75-minute sessions", 75, 115),
      ];
    case "small_group":
    case "hiit_conditioning":
    case "mobility_recovery":
    case "yoga_pilates_style":
      return [
        sessionRow("45-minute sessions", 45, 40),
        sessionRow("60-minute sessions", 60, 55),
        sessionRow("75-minute sessions", 75, 65),
      ];
    case "nutrition_coaching":
      return [
        {
          variationId: vid(),
          label: "Weekly coaching & accountability",
          priceUsd: 89,
          billingUnit: "per_week",
        },
        {
          variationId: vid(),
          label: "Semi-weekly coaching cadence",
          priceUsd: 159,
          billingUnit: "twice_weekly",
        },
        {
          variationId: vid(),
          label: "Monthly nutrition package",
          priceUsd: 319,
          billingUnit: "per_month",
        },
      ];
    case "online_program":
      return [
        {
          variationId: vid(),
          label: "Weekly plan design",
          priceUsd: 69,
          billingUnit: "per_week",
        },
        {
          variationId: vid(),
          label: "Semi-weekly program updates",
          priceUsd: 119,
          billingUnit: "twice_weekly",
        },
        {
          variationId: vid(),
          label: "Monthly programming block",
          priceUsd: 229,
          billingUnit: "per_month",
        },
      ];
    default:
      return [
        {
          variationId: vid(),
          label: "Standard package",
          sessionCount: 1,
          sessionMinutes: 60,
          priceUsd: 85,
          billingUnit: "per_session",
        },
      ];
  }
}

const SESSION_LENGTH_ROTATION = [60, 45, 75, 90] as const;

/** Metrics line for a checkout row (billing + session length when the template requires it). */
export function variationCheckoutSetupSummary(
  serviceId: MatchServiceId,
  delivery: ServiceDeliveryMode,
  v: Pick<TrainerServiceOfferingVariation, "billingUnit" | "sessionMinutes">,
): string {
  const units = [BILLING_UNIT_LABELS[v.billingUnit]];
  const needsLen =
    serviceOfferingNeedsSessionLength(serviceId, delivery) && !serviceOfferingIsDiyTemplate(serviceId);
  if (needsLen && v.sessionMinutes != null && Number.isFinite(v.sessionMinutes)) {
    units.push(`${Math.floor(v.sessionMinutes)} min`);
  }
  return units.join(" · ");
}

/** One checkout row seeded from list price & billing (dashboard “Add variation”). Rotates session length for timed templates. */
export function variationRowFromBaseMetrics(args: {
  serviceId: MatchServiceId;
  delivery: ServiceDeliveryMode;
  priceUsd: number;
  billingUnit: BillingUnit;
  /** Rows already on screen before this add. */
  rowIndex: number;
  /** When set (timed templates), seeds session length instead of rotating defaults. */
  sessionMinutesOverride?: number;
}): TrainerServiceOfferingVariation {
  const bu = args.billingUnit === "multi_session" ? "per_session" : args.billingUnit;
  const price = Math.min(5000, Math.max(15, Math.round(args.priceUsd * 100) / 100));
  const needsLen =
    serviceOfferingNeedsSessionLength(args.serviceId, args.delivery) && !serviceOfferingIsDiyTemplate(args.serviceId);
  const minutes = needsLen
    ? args.sessionMinutesOverride != null && Number.isFinite(args.sessionMinutesOverride)
      ? clampTrainerServiceSessionMinutes(args.sessionMinutesOverride)
      : SESSION_LENGTH_ROTATION[args.rowIndex % SESSION_LENGTH_ROTATION.length]
    : undefined;
  const label = variationCheckoutSetupSummary(args.serviceId, args.delivery, {
    billingUnit: bu,
    sessionMinutes: minutes,
  });
  const row: TrainerServiceOfferingVariation = {
    variationId: vid(),
    label,
    priceUsd: price,
    billingUnit: bu,
  };
  if (variationRequiresSessionCount(args.serviceId, bu)) {
    row.sessionCount = 1;
  }
  if (minutes != null) {
    row.sessionMinutes = minutes;
  }
  return row;
}

export function emptyBundleTier(): TrainerServiceOfferingBundleTier {
  return { tierId: tid(), quantity: 4, priceUsd: 0, label: "" };
}
