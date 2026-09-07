import { NextResponse } from "next/server";
import { listPendingTrainerResumeSignupNudges } from "@/lib/trainer-resume-signup-nudge-cron";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const nudges = await listPendingTrainerResumeSignupNudges();
  return NextResponse.json({ nudges });
}
