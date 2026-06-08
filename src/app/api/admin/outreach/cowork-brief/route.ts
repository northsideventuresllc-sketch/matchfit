import { NextResponse } from "next/server";
import { buildCoworkMorningBrief } from "@/lib/outreach-ai";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const brief = await buildCoworkMorningBrief();
    return NextResponse.json(brief);
  } catch (e) {
    console.error("[outreach cowork-brief]", e);
    return NextResponse.json({ error: "Could not build cowork brief." }, { status: 500 });
  }
}
