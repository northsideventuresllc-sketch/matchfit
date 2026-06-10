import { NextResponse } from "next/server";
import { ADMIN_ANTHROPIC_MODEL_OPTIONS, probeAdminAiProvider } from "@/lib/admin-analytics-ai";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const status = await probeAdminAiProvider();
  return NextResponse.json({
    ...status,
    availableModels:
      status.provider === "anthropic"
        ? ADMIN_ANTHROPIC_MODEL_OPTIONS.map((m) => ({ id: m.id, label: m.label }))
        : [],
  });
}
