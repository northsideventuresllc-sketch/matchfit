import { z } from "zod";

export const coachPurchaseReceiptDeliveries = ["EMAIL", "SMS", "NONE"] as const;

export const clientNotificationPrefsSchema = z.object({
  pushNudge: z.boolean().default(true),
  pushNewMatch: z.boolean().default(true),
  pushDailyQuestionnaire: z.boolean().default(true),
  pushAppUpdate: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  pushSystem: z.boolean().default(true),
  /** Coach package receipts after Stripe completes (email, SMS via Twilio, or in-app only). */
  coachPurchaseReceiptDelivery: z.enum(coachPurchaseReceiptDeliveries).default("EMAIL"),
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
};

export function parseClientNotificationPrefsJson(raw: string | null | undefined): ClientNotificationPrefs {
  if (!raw?.trim()) return { ...defaultClientNotificationPrefs };
  try {
    const parsed = clientNotificationPrefsSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return { ...defaultClientNotificationPrefs };
    return {
      ...defaultClientNotificationPrefs,
      ...parsed.data,
      coachPurchaseReceiptDelivery:
        parsed.data.coachPurchaseReceiptDelivery ?? defaultClientNotificationPrefs.coachPurchaseReceiptDelivery,
    };
  } catch {
    return { ...defaultClientNotificationPrefs };
  }
}

export function serializeClientNotificationPrefs(p: ClientNotificationPrefs): string {
  return JSON.stringify(clientNotificationPrefsSchema.parse(p));
}
