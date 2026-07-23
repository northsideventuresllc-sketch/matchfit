import { NextResponse } from "next/server";
import { formatUserFacingError } from "@/lib/read-json-response";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { scanOutreachEmailReplies } from "@/lib/outreach-email-scan";
import { createOutreachInstagramScanJob } from "@/lib/outreach-instagram-scan";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Manual "Scan" trigger for the Pending Responses tab. Runs the email reply check inline
 * (Microsoft Graph, fast) and queues an Instagram Cowork scan job (async, worked by a Cowork
 * session that posts replies back to the scan-job completion callback).
 */
export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();

    const email = await scanOutreachEmailReplies({ adminId: sess.adminId });
    const instagram = await createOutreachInstagramScanJob({ adminId: sess.adminId });

    return NextResponse.json({
      email: { configured: email.configured, matched: email.matched.length, matches: email.matched },
      instagram: { jobId: instagram.jobId, candidateCount: instagram.candidateCount },
    });
  } catch (e) {
    console.error("[outreach pending-responses scan]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not run pending-response scan.") },
      { status: 500 },
    );
  }
}
