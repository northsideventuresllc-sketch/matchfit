import { NextResponse } from "next/server";
import { probeAdminAiProvider } from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const status = await probeAdminAiProvider();
  return NextResponse.json({
    ...status,
    anthropic: {
      integrated: false,
      message: "Match Fit uses OpenAI for the admin assistant. Anthropic is not configured in this app.",
    },
  });
}
