import type { BillingUnit, MatchServiceId } from "@/lib/trainer-match-questionnaire";
import type { TrainerServiceOfferingBundleTier, TrainerServiceOfferingVariation } from "@/lib/trainer-service-offerings";

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
    sessionMinutes: minutes,
    priceUsd,
    billingUnit: billing,
    bundleTiers: [
      {
        tierId: tid(),
        quantity: 4,
        priceUsd: Math.round(priceUsd * 4 * 0.92 * 100) / 100,
        label: "4-pack (≈8% off)",
      },
      {
        tierId: tid(),
        quantity: 8,
        priceUsd: Math.round(priceUsd * 8 * 0.85 * 100) / 100,
        label: "8-pack (≈15% off)",
      },
    ],
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
          bundleTiers: [
            {
              tierId: tid(),
              quantity: 3,
              priceUsd: 549,
              label: "3-month prepay",
            },
          ],
        },
        {
          variationId: vid(),
          label: "Weekly coaching + messaging",
          priceUsd: 349,
          billingUnit: "per_month",
          bundleTiers: [
            {
              tierId: tid(),
              quantity: 3,
              priceUsd: 949,
              label: "3-month prepay",
            },
          ],
        },
      ];
    case "online_program":
      return [
        {
          variationId: vid(),
          label: "4-week custom plan",
          priceUsd: 249,
          billingUnit: "multi_session",
        },
        {
          variationId: vid(),
          label: "8-week custom plan",
          priceUsd: 449,
          billingUnit: "multi_session",
          bundleTiers: [
            {
              tierId: tid(),
              quantity: 2,
              priceUsd: 799,
              label: "Two 8-week cycles",
            },
          ],
        },
      ];
    default:
      return [
        {
          variationId: vid(),
          label: "Standard package",
          sessionMinutes: 60,
          priceUsd: 85,
          billingUnit: "per_session",
        },
      ];
  }
}

export function emptyBundleTier(): TrainerServiceOfferingBundleTier {
  return { tierId: tid(), quantity: 4, priceUsd: 0, label: "" };
}
