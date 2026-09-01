import { NextResponse } from "next/server";
import { estDateString } from "@/lib/content-calendar/schedule-utils";
import { findTodaysMissingPostTypes } from "@/lib/content-calendar/content-calendar-v2-store";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

/** WF1.01 fix: surfaces today's missing four-pack formats on the Content Calendar screen. */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ date: null, missingPostTypes: [] });
  }

  try {
    const date = estDateString();
    const missingPostTypes = await findTodaysMissingPostTypes(date);
    return NextResponse.json({ date, missingPostTypes });
  } catch (e) {
    console.error("[content-calendar today-gap]", e);
    return NextResponse.json({ date: null, missingPostTypes: [] });
  }
}
