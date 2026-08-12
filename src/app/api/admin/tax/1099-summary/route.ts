import { getSessionAdminId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { IRS_1099_NEC_THRESHOLD_CENTS, listTrainerEarningsForTaxYear } from "@/lib/trainer-tax-year-earnings";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Internal reporting only — this does NOT file anything with the IRS. It tells staff who earned
 * $600+ in the given tax year so they know who a 1099-NEC is owed to; the actual filing
 * mechanism (Stripe Connect's own tax-forms product vs. a separate filing vendor vs. manual) is
 * a decision for JB, not something this route assumes.
 */
export async function GET(req: Request) {
  const adminId = await getSessionAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const rows = await listTrainerEarningsForTaxYear(year);
  const trainers = await prisma.trainer.findMany({
    where: { id: { in: rows.map((r) => r.trainerId) } },
    select: { id: true, email: true, firstName: true, lastName: true, username: true },
  });
  const byId = new Map(trainers.map((t) => [t.id, t]));

  return NextResponse.json({
    year,
    thresholdCents: IRS_1099_NEC_THRESHOLD_CENTS,
    rows: rows.map((r) => ({
      ...r,
      trainer: byId.get(r.trainerId) ?? null,
    })),
  });
}
