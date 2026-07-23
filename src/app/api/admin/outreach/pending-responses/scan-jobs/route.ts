import { NextResponse } from "next/server";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The external Cowork session polls with the shared CRON_SECRET (no admin cookie). */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/**
 * GET /api/admin/outreach/pending-responses/scan-jobs
 *
 * Lists queued Instagram DM scan jobs (with their full brief) for an external Cowork
 * Desktop-Control session to pick up.
 */
export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
