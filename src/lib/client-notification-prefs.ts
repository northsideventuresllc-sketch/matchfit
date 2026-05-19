import { z } from "zod";

export const coachPurchaseReceiptChannelOptions = ["EMAIL", "PUSH"] as const;
export type CoachPurchaseReceiptChannel = (typeof coachPurchaseReceiptChannelOptions)[number];

export const clientNotificationPrefsSchema = z.object({
  pushNudge: z.boolean().default(true),
  pushNewMatch: z.boolean().default(true),
  pushDailyQuestionnaire: z.boolean().default(true),
  pushAppUpdate: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  pushSystem: z.boolean().default(true),
  /** Duplicate coach package receipts — client may enable email, push, both, or neither (in-app billing always applies). */
  coachPurchaseReceiptEmail: z.boolean().default(true),
  coachPurchaseReceiptPush: z.boolean().default(false),
});

export type ClientNotificationPrefs = z.infer<typeof clientNotificationPrefsSchema>;

export const defaultClientNotificationPrefs: ClientNotificationPrefs = {
  pushNudge: true,
  pushNewMatch: true,
  pushDailyQuestionnaire: true,
  pushAppUpdate: true,
  pushBilling: true,
  pushSystem: true,
  coachPurchaseReceiptEmail: true,
  coachPurchaseReceiptPush: false,
};

function migrateLegacyReceiptPrefs(rawObj: Record<string, unknown>): void {
  const legacy = rawObj.coachPurchaseReceiptDelivery;
  if (typeof legacy !== "string") return;
  if (legacy === "EMAIL") {
    rawObj.coachPurchaseReceiptEmail = true;
    rawObj.coachPurchaseReceiptPush = false;
  } else if (legacy === "PUSH") {
    rawObj.coachPurchaseReceiptEmail = false;
    rawObj.coachPurchaseReceiptPush = true;
  } else if (legacy === "NONE" || legacy === "SMS") {
    rawObj.coachPurchaseReceiptEmail = false;
    rawObj.coachPurchaseReceiptPush = false;
  }
  delete rawObj.coachPurchaseReceiptDelivery;
}

export function parseClientNotificationPrefsJson(raw: string | null | undefined): ClientNotificationPrefs {
  if (!raw?.trim()) return { ...defaultClientNotificationPrefs };
  try {
    const rawObj = JSON.parse(raw) as Record<string, unknown>;
    migrateLegacyReceiptPrefs(rawObj);
    const parsed = clientNotificationPrefsSchema.safeParse(rawObj);
    if (!parsed.success) return { ...defaultClientNotificationPrefs };
    return {
      ...defaultClientNotificationPrefs,
      ...parsed.data,
    };
  } catch {
    return { ...defaultClientNotificationPrefs };
  }
}

export function serializeClientNotificationPrefs(p: ClientNotificationPrefs): string {
  return JSON.stringify(clientNotificationPrefsSchema.parse(p));
}
