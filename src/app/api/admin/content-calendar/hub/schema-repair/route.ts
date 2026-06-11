import { NextResponse } from "next/server";
import { ensureContentHubSchema, isMissingContentHubSchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentHubSchema();
    return NextResponse.json({
      ok: true,
      message: "Content Hub schema is ready on NI Brain.",
    });
  } catch (e) {
    console.error("[content-calendar hub schema-repair]", e);
    return NextResponse.json(
      {
        error: formatUserFacingError(
          e,
          "Could not repair Content Hub schema on NI Brain.",
        ),
      },
      { status: isMissingContentHubSchemaError(e) ? 503 : 500 },
    );
  }
}
