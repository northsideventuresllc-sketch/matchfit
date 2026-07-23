import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CONTENT_CALENDAR_SETTINGS_DEFAULTS,
  getContentCalendarSettings,
  updateContentCalendarSettings,
} from "@/lib/content-calendar/cowork-jobs";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const POSTED_RETENTION_MAX_HOURS = 8760;
const SCRAPPED_RETENTION_MAX_DAYS = 365;

const patchSchema = z
  .object({
    postedRetentionHours: z.number().int().min(1).max(POSTED_RETENTION_MAX_HOURS).optional(),
    scrappedRetentionDays: z.number().int().min(1).max(SCRAPPED_RETENTION_MAX_DAYS).optional(),
  })
  .refine((v) => v.postedRetentionHours !== undefined || v.scrappedRetentionDays !== undefined, {
    message: "Provide postedRetentionHours or scrappedRetentionDays.",
  });

function serializeSettings(row: Awaited<ReturnType<typeof getContentCalendarSettings>>) {
  return {
    postedRetentionHours: row?.posted_retention_hours ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.posted_retention_hours,
    scrappedRetentionDays: row?.scrapped_retention_days ?? CONTENT_CALENDAR_SETTINGS_DEFAULTS.scrapped_retention_days,
    updatedAt: row?.updated_at ?? null,
    limits: { postedRetentionMaxHours: POSTED_RETENTION_MAX_HOURS, scrappedRetentionMaxDays: SCRAPPED_RETENTION_MAX_DAYS },
  };
}

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }
  try {
    await ensureContentCalendarV22Schema();
    const row = await getContentCalendarSettings();
    return NextResponse.json({ settings: serializeSettings(row) });
  } catch (e) {
    console.error("[content-calendar v2 settings GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load content calendar settings.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid retention settings." },
      { status: 400 },
    );
  }

  try {
    await ensureContentCalendarV22Schema();
    const row = await updateContentCalendarSettings({
      postedRetentionHours: parsed.data.postedRetentionHours,
      scrappedRetentionDays: parsed.data.scrappedRetentionDays,
    });
    return NextResponse.json({ settings: serializeSettings(row) });
  } catch (e) {
    console.error("[content-calendar v2 settings PATCH]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not update content calendar settings.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}
