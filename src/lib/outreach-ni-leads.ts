import "server-only";

/**
 * NI SERVICES OUTREACH — read model for the NI lane.
 *
 * Its own module, its own query, its own screen. Nothing here reads or returns a Match Fit lead
 * and nothing in the Match Fit outreach modules reads an NI lead: the two lanes never share a
 * screen (JB LOCKED, nvg-four-workflows).
 *
 * READ-ONLY AND DRAFT-ONLY. There is no send path in this module, by design. NI mail sends from
 * jb@northsideintelligence.com with `RESEND_API_KEY_NI` — the two-account Resend rule — and only
 * ever after JB has edited and approved each line.
 *
 * Every lead is returned with its full four-level path resolved (venture -> category -> offering
 * -> audience) plus the concrete deliverable, so JB never has to guess what a lead is a pitch for.
 */

import { NI_SERVICES_VENTURE_SLUG, resolveLeadTaxonomyPath } from "@/lib/lead-taxonomy";
import { prisma } from "@/lib/prisma";
import { scopedToVenture } from "@/lib/outreach-venture-scope";

export type NiOutreachLead = {
  id: string;
  business: string;
  email: string;
  niche: string | null;
  /** Page the address was found on — the proof behind the contact. */
  sourceUrl: string | null;
  /** The specific thing NI would hand over. Never a vague "we can help" line. */
  deliverable: string;
  score: number;
  /** Plain-English breadcrumb: venture, category, offering, audience. */
  taxonomyLabel: string;
  venture: string | null;
  category: string | null;
  offering: string | null;
  audience: string | null;
  isFiled: boolean;
  emailSubject: string;
  emailBody: string;
  /** Null until JB approves and it actually goes out. Every row here should be null. */
  sentAt: string | null;
  createdAt: string;
};

export async function listNiOutreachLeads(): Promise<NiOutreachLead[]> {
  const rows = await prisma.outreachEmailLead.findMany({
    where: scopedToVenture({ deletedAt: null, archivedAt: null }, NI_SERVICES_VENTURE_SLUG),
    include: {
      venture: { select: { slug: true, displayName: true } },
      offering: {
        select: {
          slug: true,
          displayName: true,
          category: { select: { slug: true, displayName: true } },
        },
      },
      taxonomyAudience: { select: { code: true, displayName: true } },
    },
    orderBy: [{ likelihoodScore: "desc" }, { createdAt: "asc" }],
  });

  return rows.map((r) => {
    const path = resolveLeadTaxonomyPath(r);
    return {
      id: r.id,
      business: r.businessName ?? r.name,
      email: r.email,
      niche: r.niche,
      sourceUrl: r.emailSourceUrl,
      // `whyMatchFit` is the legacy column name shared by all four lead tables; on an NI lead it
      // carries the deliverable. Renamed at this boundary so JB's screen never shows a Match Fit
      // word on an NI row.
      deliverable: r.whyMatchFit,
      score: r.likelihoodScore,
      taxonomyLabel: path.label,
      venture: path.venture?.displayName ?? null,
      category: path.category?.displayName ?? null,
      offering: path.offering?.displayName ?? null,
      audience: path.audience?.displayName ?? null,
      isFiled: path.isComplete,
      emailSubject: r.emailSubject,
      emailBody: r.emailBody,
      sentAt: r.outreachSentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
