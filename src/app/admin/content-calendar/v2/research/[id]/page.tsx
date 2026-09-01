import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getResearchRun, serializeResearchRun } from "@/lib/content-calendar/content-research-store";
import { ensureContentCalendarV23Schema } from "@/lib/ensure-content-hub-schema";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import { ReportArtifactViewer } from "../../components/report-artifact-viewer";

/**
 * Standalone, directly linkable research report — "open in its own tab" for the Social Media
 * Research panel. Server-rendered, no AdminPortalShell/nav chrome, reads the store directly
 * (no API round trip) since this is already a server component.
 */
export default async function ContentCalendarResearchRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  const { id } = await params;
  await ensureContentCalendarV23Schema();
  const row = await getResearchRun(id);
  if (!row) notFound();

  const run = serializeResearchRun(row);
  const reportBody =
    run.reportBody ?? (run.status === "failed" ? `This run failed: ${run.error ?? "Unknown error."}` : "Report not available yet.");

  return (
    <ReportArtifactViewer
      title="Social Media Research"
      dateLabel={run.runDate}
      summary={run.summary ?? ""}
      reportBody={reportBody}
      model={run.model}
    />
  );
}
