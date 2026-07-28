import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listNiOutreachLeads } from "@/lib/outreach-ni-leads";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";

/**
 * NI OUTREACH HQ — the NI Services lane.
 *
 * A SEPARATE SCREEN from Match Fit Outreach HQ on purpose (JB LOCKED): the two ventures never
 * share a surface. Nothing on this page sends, approves or queues anything — it is the review
 * board for drafted leads. JB edits every line and approves before a single message goes out,
 * and NI mail goes out from jb@northsideintelligence.com on the NI Resend account.
 */
export const dynamic = "force-dynamic";

export default async function NiOutreachHqPage() {
  const store = await cookies();
  const tok = store.get(ADMIN_SESSION_COOKIE)?.value;
  const sess = tok ? await verifyAdminSessionToken(tok) : null;
  if (!sess) redirect("/admin/login");

  const adminRow = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true },
  });
  if (!adminRow) redirect("/admin/login");

  const leads = await listNiOutreachLeads();
  const webDesign = leads.filter((l) => l.offering === "Custom Web Design and Management").length;
  const unsent = leads.filter((l) => !l.sentAt).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs uppercase tracking-widest text-neutral-500">Northside Intelligence</p>
      <h1 className="mt-1 text-2xl font-semibold">NI Outreach HQ</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Drafted NI Services leads. Nothing here has been sent. Edit every line, then approve.
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-neutral-200 p-3">
          <dt className="text-xs text-neutral-500">Leads in the pool</dt>
          <dd className="text-xl font-semibold">{leads.length}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3">
          <dt className="text-xs text-neutral-500">Web design pitches</dt>
          <dd className="text-xl font-semibold">{webDesign}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3">
          <dt className="text-xs text-neutral-500">Waiting on you</dt>
          <dd className="text-xl font-semibold">{unsent}</dd>
        </div>
      </dl>

      {leads.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-600">No NI leads are drafted right now.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {leads.map((l) => (
            <li key={l.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{l.business}</h2>
                <span className="text-xs text-neutral-500">
                  {l.sentAt ? "Sent" : "Draft — not sent"}
                </span>
              </div>

              <p className="mt-1 text-xs text-neutral-500">{l.taxonomyLabel}</p>

              <p className="mt-3 text-sm">
                <span className="font-medium">What we would hand over: </span>
                {l.deliverable}
              </p>

              <div className="mt-3 text-sm text-neutral-700">
                <p className="font-medium">{l.emailSubject}</p>
                <p className="mt-1 whitespace-pre-line">{l.emailBody}</p>
              </div>

              <p className="mt-3 text-xs text-neutral-500">
                {l.email}
                {l.niche ? ` · ${l.niche}` : ""}
                {l.sourceUrl ? ` · found on ${l.sourceUrl}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
