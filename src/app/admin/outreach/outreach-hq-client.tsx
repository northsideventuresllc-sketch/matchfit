"use client";

import Link from "next/link";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { adminAccentButtonClass, adminCardClass } from "@/components/admin/admin-portal-ui";

/**
 * Outreach HQ v1 — retired (cutover to v2 complete, see outreach-hq-v2-client.tsx). The full v1
 * lead-management UI that used to live here is gone; this route now just points forward and stays
 * reachable so the archive-tools page (a separate build) has somewhere stable to link from.
 */
export function OutreachHqRetiredNotice() {
  return (
    <AdminPortalShell current="outreach" maxWidth="3xl" title="Outreach HQ v1 — retired">
      <div className={`${adminCardClass} space-y-4 p-8 text-center`}>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FF7E00]/90">Moved</p>
        <h2 className="text-2xl font-black text-white">This tool has moved to Outreach HQ</h2>
        <p className="text-sm leading-relaxed text-white/60">
          Outreach HQ v1 is retired. All leads, follow-ups, and sends now live in Outreach HQ v2.
        </p>
        <Link href="/admin/outreach/v2" className={`${adminAccentButtonClass} inline-block`}>
          Open Outreach HQ
        </Link>
      </div>
    </AdminPortalShell>
  );
}
