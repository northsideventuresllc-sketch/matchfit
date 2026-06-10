import { NextResponse } from "next/server";
import { listRegisteredTrainersForOutreach } from "@/lib/outreach-registered-trainers";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const trainers = await listRegisteredTrainersForOutreach();
    return NextResponse.json({ trainers, total: trainers.length });
  } catch (e) {
    console.error("[outreach registered-trainers GET]", e);
    return NextResponse.json({ error: "Could not load registered trainers." }, { status: 500 });
  }
}
