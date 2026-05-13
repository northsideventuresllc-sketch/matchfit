import { z } from "zod";

export const coachPurchaseReceiptDeliveries = ["EMAIL", "PUSH", "NONE"] as const;

export const clientNotificationPrefsSchema = z.object({
  pushNudge: z.boolean().default(true),
  pushNewMatch: z.boolean().default(true),
  pushDailyQuestionnaire: z.boolean().default(true),
  pushAppUpdate: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  pushSystem: z.boolean().default(true),
  /** Coach package receipts after Stripe completes (email, Web Push lock-screen summary, or in-app only). */
  coachPurchaseReceiptDelivery: z.enum(coachPurchaseReceiptDeliveries).default("EMAIL"),
  emailWelcome: z.boolean().default(true),
  emailPurchases: z.boolean().default(true),
  emailBilling: z.boolean().default(true),
  emailCompliance: z.boolean().default(true),
  emailTrustSafety: z.boolean().default(true),
  emailProduct: z.boolean().default(true),
});

export type ClientNotificationPrefs = z.infer<typeof clientNotificationPrefsSchema>;

export const defaultClientNotificationPrefs: ClientNotificationPrefs = {
  pushNudge: true,
  pushNewMatch: true,
  pushDailyQuestionnaire: true,
  pushAppUpdate: true,
  pushBilling: true,
  pushSystem: true,
  coachPurchaseReceiptDelivery: "EMAIL",
  emailWelcome: true,
  emailPurchases: true,
  emailBilling: true,
  emailCompliance: true,
  emailTrustSafety: true,
  emailProduct: true,
};

export function parseClientNotificationPrefsJson(raw: string | null | undefined): ClientNotificationPrefs {
  if (!raw?.trim()) return { ...defaultClientNotificationPrefs };
  try {
    const rawObj = JSON.parse(raw) as Record<string, unknown>;
    if (rawObj.coachPurchaseReceiptDelivery === "SMS") {
      rawObj.coachPurchaseReceiptDelivery = "EMAIL";
    }
    const parsed = clientNotificationPrefsSchema.safeParse(rawObj);
    if (!parsed.success) return { ...defaultClientNotificationPrefs };
    return {
      ...defaultClientNotificationPrefs,
      ...parsed.data,
      coachPurchaseReceiptDelivery:
        parsed.data.coachPurchaseReceiptDelivery ?? defaultClientNotificationPrefs.coachPurchaseReceiptDelivery,
      emailWelcome: parsed.data.emailWelcome ?? defaultClientNotificationPrefs.emailWelcome,
      emailPurchases: parsed.data.emailPurchases ?? defaultClientNotificationPrefs.emailPurchases,
      emailBilling: parsed.data.emailBilling ?? defaultClientNotificationPrefs.emailBilling,
      emailCompliance: parsed.data.emailCompliance ?? defaultClientNotificationPrefs.emailCompliance,
      emailTrustSafety: parsed.data.emailTrustSafety ?? defaultClientNotificationPrefs.emailTrustSafety,
      emailProduct: parsed.data.emailProduct ?? defaultClientNotificationPrefs.emailProduct,
    };
  } catch {
    return { ...defaultClientNotificationPrefs };
  }
}

export function serializeClientNotificationPrefs(p: ClientNotificationPrefs): string {
  return JSON.stringify(clientNotificationPrefsSchema.parse(p));
}
