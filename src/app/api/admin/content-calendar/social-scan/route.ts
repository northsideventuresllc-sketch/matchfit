import { NextResponse } from "next/server";
import { analyzeSocialPerformance } from "@/lib/content-calendar/content-calendar-ai";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";

export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await hydratePlatformEnvFromDatabase();
    const summary = await analyzeSocialPerformance();
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("[content-calendar social-scan]", e);
    return NextResponse.json({ error: "Social scan failed." }, { status: 500 });
  }
}
