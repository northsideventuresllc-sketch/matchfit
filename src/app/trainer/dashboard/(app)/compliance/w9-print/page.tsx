import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerPrintPageButton } from "@/components/trainer/trainer-print-page-button";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Print W-9 | Trainer | Match Fit",
};

type W9Stored = {
  legalName?: string;
  businessName?: string;
  federalTaxClassification?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  tinType?: string;
  tin?: string;
  submittedAt?: string;
};

function maskTin(tin: string | undefined): string {
  const raw = (tin ?? "").replace(/\s/g, "");
  if (!raw) return "—";
  if (raw.length <= 4) return "••••";
  return `${"•".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

export default async function TrainerW9PrintPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const row = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasUploadedW9: true,
      w9Json: true,
      hasSignedTOS: true,
      backgroundCheckStatus: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
    },
  });

  if (!row || !isTrainerComplianceComplete(row)) {
    redirect("/trainer/dashboard");
  }

  if (!row.hasUploadedW9 || !row.w9Json?.trim()) {
    redirect("/trainer/dashboard/compliance");
  }

  let w9: W9Stored = {};
  try {
    w9 = JSON.parse(row.w9Json) as W9Stored;
  } catch {
    redirect("/trainer/dashboard/compliance");
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/trainer/dashboard/compliance" className="text-sm text-[#FF7E00] underline-offset-2 hover:underline">
          ← Compliance Details
        </Link>
        <TrainerPrintPageButton />
      </div>
      <header className="border-b border-white/10 pb-4 print:border-black/20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45 print:text-black/60">Match Fit Trainer</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white print:text-black">W-9 Information on File</h1>
        <p className="mt-2 text-sm text-white/50 print:text-black/70">
          For your records. Tax identification is partially masked on screen; use email self-service or your PDF printout
          for the full number if needed.
        </p>
      </header>
      <dl className="grid gap-4 text-sm print:text-black sm:grid-cols-2">
        {(
          [
            ["Legal name", w9.legalName ?? "—"],
            ["Business name", w9.businessName ?? "—"],
            ["Federal tax classification", w9.federalTaxClassification ?? "—"],
            ["Address line 1", w9.addressLine1 ?? "—"],
            ["Address line 2", w9.addressLine2 ?? "—"],
            ["City", w9.city ?? "—"],
            ["State", w9.state ?? "—"],
            ["ZIP", w9.zip ?? "—"],
            ["TIN type", w9.tinType ?? "—"],
            ["TIN (masked on screen)", maskTin(w9.tin)],
            ["Submitted", w9.submittedAt ? new Date(w9.submittedAt).toLocaleString() : "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/[0.06] bg-[#0E1016]/50 p-4 print:border-black/15 print:bg-white">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/40 print:text-black/55">{k}</dt>
            <dd className="mt-1 font-medium text-white/90 print:text-black">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-white/35 print:text-black/60">
        Match Fit does not provide tax advice. Consult a tax professional for how to use this information.
      </p>
    </div>
  );
}
