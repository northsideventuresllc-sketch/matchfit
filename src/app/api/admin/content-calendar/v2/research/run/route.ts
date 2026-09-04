import { NextResponse } from "next/server";
import { runContentResearchPass } from "@/lib/content-calendar/run-research-pass";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs one Social Media Research pass for Match Fit (manual "Run" button). The heavy lifting —
 * building context, folding in AXON's Match Fit findings, calling the AI Vault chain, recording the
 * run — lives in runContentResearchPass so the daily cron can reuse it.
 */
export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const run = await runContentResearchPass({ adminId: sess.adminId, trigger: "manual" });
    return NextResponse.json({ run });
  } catch (e) {
    console.error("[content-calendar v2 research run]", e);
    const message = formatUserFacingError(e, "Could not run social media research.");
    return NextResponse.json(
      { error: message },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}
