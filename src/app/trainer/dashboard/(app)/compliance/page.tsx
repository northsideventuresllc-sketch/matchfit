import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TRAINER_ONBOARDING_AGREEMENT_BULLETS } from "@/app/trainer/onboarding/trainer-agreement-bullets";
import { TrainerComplianceW9EmailSelfService } from "@/components/trainer/trainer-compliance-w9-email-self-service";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { backgroundCheckStatusLabel, certificationReviewStatusLabel } from "@/lib/trainer-compliance-status-copy";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Compliance Details | Trainer | Match Fit",
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

export default async function TrainerComplianceDetailsPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      hasUploadedW9: true,
      w9Json: true,
      backgroundCheckStatus: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      certificationUrl: true,
      otherCertificationUrl: true,
      nutritionistCertificationUrl: true,
    },
  });

  if (!isTrainerComplianceComplete(profile)) {
    redirect("/trainer/dashboard");
  }

  let w9: W9Stored | null = null;
  if (profile?.w9Json?.trim()) {
    try {
      w9 = JSON.parse(profile.w9Json) as W9Stored;
    } catch {
      w9 = null;
    }
  }

  const certFiles: { label: string; href: string }[] = [];
  if (profile?.certificationUrl) {
    certFiles.push({ label: "CPT or primary certification", href: profile.certificationUrl });
  }
  if (profile?.otherCertificationUrl) {
    certFiles.push({ label: "Additional certification", href: profile.otherCertificationUrl });
  }
  if (profile?.nutritionistCertificationUrl) {
    certFiles.push({ label: "Nutrition credential", href: profile.nutritionistCertificationUrl });
  }

  const bgLabel = backgroundCheckStatusLabel(profile?.backgroundCheckStatus);
  const cptLabel = certificationReviewStatusLabel(profile?.certificationReviewStatus);
  const nutLabel = certificationReviewStatusLabel(profile?.nutritionistCertificationReviewStatus);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Compliance</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Compliance Details</h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/50">
          Review your agreements, tax information, screening result, and uploaded credentials. Contact support if anything
          looks incorrect.
        </p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Trainer Terms of Service</h2>
        <p className="mt-3 text-sm text-white/55">
          You agreed to the platform terms during onboarding. The public Terms of Service page is always available for
          review.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            Open Terms of Service
          </Link>
        </div>
        <details className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0E1016]/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white/70">Trainer acknowledgement checklist</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-white/50">
            {TRAINER_ONBOARDING_AGREEMENT_BULLETS.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">W-9 on File</h2>
        {w9 ? (
          <>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Legal Name</dt>
                <dd className="mt-0.5 text-white/85">{w9.legalName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Business Name</dt>
                <dd className="mt-0.5 text-white/85">{w9.businessName ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Address</dt>
                <dd className="mt-0.5 text-white/85">
                  {[w9.addressLine1, w9.addressLine2].filter(Boolean).join(", ") || "—"}
                  <br />
                  {[w9.city, w9.state, w9.zip].filter(Boolean).join(", ") || ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">TIN (Masked)</dt>
                <dd className="mt-0.5 font-mono text-white/85">{maskTin(w9.tin)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Submitted</dt>
                <dd className="mt-0.5 text-white/85">
                  {w9.submittedAt ? new Date(w9.submittedAt).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Download or Email</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/trainer/dashboard/compliance/w9-print"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Open Printable W-9
                </Link>
              </div>
              <TrainerComplianceW9EmailSelfService />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/50">No W-9 data found on file.</p>
        )}
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Background Check</h2>
        <p className="mt-3 text-sm text-white/75">
          Vendor status: <span className="font-semibold text-white">{bgLabel}</span>
        </p>
        <p className="mt-2 text-xs text-white/45">
          Detailed reports are maintained by the screening provider. Contact Match Fit support if you have questions
          about your result.
        </p>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Certification Review</h2>
        <p className="mt-3 text-sm text-white/60">
          {profile?.onboardingTrackCpt ? (
            <span className="block">
              CPT / primary track: <span className="font-semibold text-white/90">{cptLabel}</span>
            </span>
          ) : null}
          {profile?.onboardingTrackNutrition ? (
            <span className="mt-1 block">
              Nutrition track: <span className="font-semibold text-white/90">{nutLabel}</span>
            </span>
          ) : null}
          {!profile?.onboardingTrackCpt && !profile?.onboardingTrackNutrition ? (
            <span className="font-semibold text-white/90">{cptLabel}</span>
          ) : null}
        </p>
        {certFiles.length ? (
          <ul className="mt-4 space-y-2">
            {certFiles.map((f) => (
              <li key={f.href}>
                <span className="text-sm text-white/55">{f.label}: </span>
                <Link href={f.href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#FF7E00] underline-offset-2 hover:underline">
                  Open file
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/45">No certification files on record.</p>
        )}
      </section>

      <p className="text-sm">
        <Link href="/trainer/dashboard" className="text-[#FF7E00] underline-offset-2 hover:underline">
          ← Back to Dashboard
        </Link>
      </p>
    </div>
  );
}
