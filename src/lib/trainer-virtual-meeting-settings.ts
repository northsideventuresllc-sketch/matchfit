import { z } from "zod";

const schema = z.object({
  defaultDurationMins: z.number().int().min(15).max(240).optional(),
  preferredSyncPlatform: z.enum(["GOOGLE", "ZOOM", "MICROSOFT"]).nullable().optional(),
  remindFiveMinutesBefore: z.boolean().optional(),
});

export type TrainerVirtualMeetingSettings = z.infer<typeof schema>;

const DEFAULTS: TrainerVirtualMeetingSettings = {
  defaultDurationMins: 60,
  preferredSyncPlatform: null,
  remindFiveMinutesBefore: true,
};

export function parseTrainerVirtualMeetingSettings(raw: string | null | undefined): TrainerVirtualMeetingSettings {
  if (!raw?.trim()) return { ...DEFAULTS };
  try {
    const j = JSON.parse(raw) as unknown;
    const p = schema.safeParse(j);
    if (!p.success) return { ...DEFAULTS };
    return { ...DEFAULTS, ...p.data };
  } catch {
    return { ...DEFAULTS };
  }
}

export function serializeTrainerVirtualMeetingSettings(
  cur: string | null | undefined,
  patch: Partial<TrainerVirtualMeetingSettings>,
): string {
  const merged = { ...parseTrainerVirtualMeetingSettings(cur), ...patch };
  return JSON.stringify(merged);
}
