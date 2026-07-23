import { NextResponse } from "next/server";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { prisma } from "@/lib/prisma";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/outreach/pending-responses/scan-jobs
 *
 * Lists queued Instagram DM scan jobs (with their full brief) for an external Cowork
 * Desktop-Control session to pick up.
 */
export async function GET(req: Request) {
  if (!(await hasValidCoworkSecret(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const jobs = await prisma.outreachCoworkScanJob.findMany({
      where: { status: { in: ["queued", "dispatched", "running"] } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("[outreach scan-jobs GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load scan jobs." }, { status: 500 });
  }
}
