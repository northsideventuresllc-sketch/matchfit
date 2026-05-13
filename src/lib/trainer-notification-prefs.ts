import { z } from "zod";

export const trainerNotificationPrefsSchema = z.object({
  pushClientInquiry: z.boolean().default(true),
  pushChatMessages: z.boolean().default(true),
  pushCertificationUpdates: z.boolean().default(true),
  pushComplianceReminders: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  billingEmailNotifications: z.boolean().default(true),
  billingPushNotifications: z.boolean().default(true),
  pushPlatformUpdates: z.boolean().default(true),
  emailWelcome: z.boolean().default(true),
  emailPurchases: z.boolean().default(true),
  emailPayouts: z.boolean().default(true),
  emailBilling: z.boolean().default(true),
  emailCompliance: z.boolean().default(true),
  emailClientInquiries: z.boolean().default(true),
  emailTrustSafety: z.boolean().default(true),
  emailProduct: z.boolean().default(true),
});

export type TrainerNotificationPrefs = z.infer<typeof trainerNotificationPrefsSchema>;

export const defaultTrainerNotificationPrefs: TrainerNotificationPrefs = {
  pushClientInquiry: true,
  pushChatMessages: true,
  pushCertificationUpdates: true,
  pushComplianceReminders: true,
  pushBilling: true,
  billingEmailNotifications: true,
  billingPushNotifications: true,
  pushPlatformUpdates: true,
  emailWelcome: true,
  emailPurchases: true,
  emailPayouts: true,
  emailBilling: true,
  emailCompliance: true,
  emailClientInquiries: true,
  emailTrustSafety: true,
  emailProduct: true,
};

export function parseTrainerNotificationPrefsJson(raw: string | null | undefined): TrainerNotificationPrefs {
  if (!raw?.trim()) return { ...defaultTrainerNotificationPrefs };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.billingTextNotifications === "boolean" && obj.billingPushNotifications === undefined) {
      obj.billingPushNotifications = obj.billingTextNotifications;
    }
    delete obj.billingTextNotifications;
    const parsed = trainerNotificationPrefsSchema.safeParse(obj);
    if (!parsed.success) return { ...defaultTrainerNotificationPrefs };
    return { ...defaultTrainerNotificationPrefs, ...parsed.data };
  } catch {
    return { ...defaultTrainerNotificationPrefs };
  }
}

export function serializeTrainerNotificationPrefs(p: TrainerNotificationPrefs): string {
  return JSON.stringify(trainerNotificationPrefsSchema.parse(p));
}
