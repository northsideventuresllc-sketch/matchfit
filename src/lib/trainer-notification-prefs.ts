import { z } from "zod";

export const trainerNotificationPrefsSchema = z.object({
  pushClientInquiry: z.boolean().default(true),
  pushChatMessages: z.boolean().default(true),
  pushCertificationUpdates: z.boolean().default(true),
  pushComplianceReminders: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  billingEmailNotifications: z.boolean().default(true),
  billingTextNotifications: z.boolean().default(false),
  pushPlatformUpdates: z.boolean().default(true),
});

export type TrainerNotificationPrefs = z.infer<typeof trainerNotificationPrefsSchema>;

export const defaultTrainerNotificationPrefs: TrainerNotificationPrefs = {
  pushClientInquiry: true,
  pushChatMessages: true,
  pushCertificationUpdates: true,
  pushComplianceReminders: true,
  pushBilling: true,
  billingEmailNotifications: true,
  billingTextNotifications: false,
  pushPlatformUpdates: true,
};

export function parseTrainerNotificationPrefsJson(raw: string | null | undefined): TrainerNotificationPrefs {
  if (!raw?.trim()) return { ...defaultTrainerNotificationPrefs };
  try {
    const parsed = trainerNotificationPrefsSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : { ...defaultTrainerNotificationPrefs };
  } catch {
    return { ...defaultTrainerNotificationPrefs };
  }
}

export function serializeTrainerNotificationPrefs(p: TrainerNotificationPrefs): string {
  return JSON.stringify(trainerNotificationPrefsSchema.parse(p));
}
