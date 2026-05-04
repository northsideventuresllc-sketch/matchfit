import type { BillingUnit, MatchServiceId, ServiceDeliveryMode } from "@/lib/trainer-match-questionnaire";
import {
  serviceOfferingIsDiyTemplate,
  serviceOfferingNeedsSessionLength,
} from "@/lib/trainer-match-questionnaire";
import {
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
          label: "Bi-weekly accountability",
          priceUsd: 199,
          billingUnit: "per_month",
        },
        {
          variationId: vid(),
          label: "Weekly coaching + messaging",
          priceUsd: 349,
          billingUnit: "per_month",
        },
      ];
    case "online_program":
      return [
        {
          variationId: vid(),
          label: "4-week custom plan",
          priceUsd: 249,
          billingUnit: "per_session",
        },
        {
          variationId: vid(),
          label: "8-week custom plan",
          priceUsd: 449,
          billingUnit: "per_session",
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

/** One checkout row seeded from list price & billing (dashboard “Add variation”). Rotates session length for timed templates. */
export function variationRowFromBaseMetrics(args: {
  serviceId: MatchServiceId;
  delivery: ServiceDeliveryMode;
  priceUsd: number;
  billingUnit: BillingUnit;
  /** Rows already on screen before this add. */
  rowIndex: number;
}): TrainerServiceOfferingVariation {
  const bu = args.billingUnit === "multi_session" ? "per_session" : args.billingUnit;
  const price = Math.min(5000, Math.max(15, Math.round(args.priceUsd * 100) / 100));
  const needsLen =
    serviceOfferingNeedsSessionLength(args.serviceId, args.delivery) && !serviceOfferingIsDiyTemplate(args.serviceId);
  const minutes = needsLen ? SESSION_LENGTH_ROTATION[args.rowIndex % SESSION_LENGTH_ROTATION.length] : undefined;
  const label = minutes != null ? `${minutes}-minute option` : `Option ${args.rowIndex + 1}`;
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
