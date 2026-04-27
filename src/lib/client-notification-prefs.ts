import { z } from "zod";

export const clientNotificationPrefsSchema = z.object({
  pushNudge: z.boolean().default(true),
  pushNewMatch: z.boolean().default(true),
  pushDailyQuestionnaire: z.boolean().default(true),
  pushAppUpdate: z.boolean().default(true),
  pushBilling: z.boolean().default(true),
  pushSystem: z.boolean().default(true),
});

export type ClientNotificationPrefs = z.infer<typeof clientNotificationPrefsSchema>;

export const defaultClientNotificationPrefs: ClientNotificationPrefs = {
  pushNudge: true,
  pushNewMatch: true,
  pushDailyQuestionnaire: true,
  pushAppUpdate: true,
  pushBilling: true,
  pushSystem: true,
};

export function parseClientNotificationPrefsJson(raw: string | null | undefined): ClientNotificationPrefs {
  if (!raw?.trim()) return { ...defaultClientNotificationPrefs };
  try {
    const parsed = clientNotificationPrefsSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : { ...defaultClientNotificationPrefs };
  } catch {
    return { ...defaultClientNotificationPrefs };
  }
}

export function serializeClientNotificationPrefs(p: ClientNotificationPrefs): string {
  return JSON.stringify(clientNotificationPrefsSchema.parse(p));
}
