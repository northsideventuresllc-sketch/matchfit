import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TRAINER_ONBOARDING_AGREEMENT_BULLETS } from "@/app/trainer/onboarding/trainer-agreement-bullets";
import { TrainerComplianceCertCarousel } from "@/components/trainer/trainer-compliance-cert-carousel";
import { TrainerComplianceCertReferenceDetails } from "@/components/trainer/trainer-compliance-cert-reference-details";
import { TrainerComplianceCertTracksForm } from "@/components/trainer/trainer-compliance-cert-tracks-form";
import { TrainerComplianceW9EmailSelfService } from "@/components/trainer/trainer-compliance-w9-email-self-service";
import { MATCH_FIT_SUPPORT_INBOX } from "@/lib/match-fit-support-inbox";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { OFF_PLATFORM_LIQUIDATED_DAMAGES_NOTICE } from "@/lib/tos-off-platform-deterrent";
import { backgroundCheckStatusLabel, certificationReviewStatusLabel } from "@/lib/trainer-compliance-status-copy";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId, getVerifiedAdminImpersonation } from "@/lib/session";
import { redactW9SsnForSupportSession } from "@/lib/w9-support-redaction";

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

function statusPillClass(status: string | null | undefined): string {
  const s = (status ?? "NOT_STARTED").trim().toUpperCase();
  if (s === "APPROVED") {
    return "border-emerald-300/35 bg-emerald-500/15 text-emerald-200";
  }
  if (s === "PENDING") {
    return "border-amber-300/35 bg-amber-500/15 text-amber-100";
  }
  if (s === "NEEDS_FURTHER_REVIEW") {
    return "border-orange-300/35 bg-orange-500/15 text-orange-100";
  }
  if (s === "DENIED") {
    return "border-rose-300/35 bg-rose-500/15 text-rose-200";
  }
  return "border-white/15 bg-white/[0.07] text-white/80";
}

function maskTin(tin: string | undefined): string {
  const raw = (tin ?? "").replace(/\s/g, "");
  if (!raw) return "—";
  if (raw.length <= 4) return "••••";
  return `${"•".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

function ComplianceReviewStatusRow(props: {
  title: string;
  status: string | null | undefined;
  statusLabel: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm font-medium text-white/80">{props.title}</span>
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-black tracking-[0.08em] ${statusPillClass(
          props.status,
        )}`}
      >
        {props.statusLabel.toUpperCase()}
      </span>
    </div>
  );
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
      backgroundCheckClearedAt: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      specialistProfessionalRole: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
      otherCertificationReviewStatus: true,
      certificationUrl: true,
      otherCertificationUrl: true,
      nutritionistCertificationUrl: true,
      specialistCertificationUrl: true,
      dashboardActivatedAt: true,
    },
  });

  if (!profile) {
    redirect("/trainer/dashboard");
  }

  const basicComplianceGate =
    profile.hasSignedTOS &&
    profile.hasUploadedW9 &&
    (profile.backgroundCheckStatus ?? "").trim().toUpperCase() === "APPROVED";
  const complianceDetailsUnlocked =
    basicComplianceGate &&
    (profile.dashboardActivatedAt != null || isTrainerComplianceComplete(profile));

  if (!complianceDetailsUnlocked) {
    redirect("/trainer/dashboard");
  }

  let w9: W9Stored | null = null;
  if (profile.w9Json?.trim()) {
    try {
      w9 = JSON.parse(profile.w9Json) as W9Stored;
    } catch {
      w9 = null;
    }
  }

  const adminImp = await getVerifiedAdminImpersonation();
  if (adminImp?.role === "trainer" && w9) {
    w9 = redactW9SsnForSupportSession(w9) as W9Stored | null;
  }

  const bgLabel = backgroundCheckStatusLabel(profile.backgroundCheckStatus);
  const cptLabel = certificationReviewStatusLabel(profile.certificationReviewStatus);
  const nutLabel = certificationReviewStatusLabel(profile.nutritionistCertificationReviewStatus);
  const specLabel = certificationReviewStatusLabel(profile.specialistCertificationReviewStatus);

  return (
    <div className="space-y-10">
      <header className="mx-auto max-w-xl space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Compliance</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Compliance Details</h1>
        <p className="text-sm leading-relaxed text-white/50">
          Review your agreements, tax information, screening result, and uploaded credentials. Contact{" "}
          <a href={`mailto:${MATCH_FIT_SUPPORT_INBOX}`} className="font-semibold text-[#FF7E00] hover:underline">
            {MATCH_FIT_SUPPORT_INBOX}
          </a>{" "}
          if anything looks incorrect.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Off-platform payments</p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{OFF_PLATFORM_LIQUIDATED_DAMAGES_NOTICE}</p>
      </section>

      <div className="space-y-10 text-left">
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Trainer Terms of Service</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          You agreed to the platform terms during onboarding. The public Terms of Service page is always available for
          review.
        </p>
        <div className="mt-4 flex flex-wrap justify-start gap-3">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            Open Terms of Service
          </Link>
        </div>
        <details className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0E1016]/40 p-4 text-left">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/70 [&::-webkit-details-marker]:hidden">
            Trainer acknowledgement checklist
          </summary>
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
                <dd className="mt-0.5 font-mono text-white/85">
                  {adminImp?.role === "trainer" && (w9.tinType ?? "").toUpperCase() === "SSN"
                    ? "Hidden for Match Fit staff"
                    : maskTin(w9.tin)}
                </dd>
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
              <div className="flex flex-wrap justify-start gap-3">
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
        <div className="mt-4 space-y-3">
          <ComplianceReviewStatusRow
            title="Vendor status"
            status={profile.backgroundCheckStatus}
            statusLabel={bgLabel}
          />
          <p className="text-xs leading-relaxed text-white/45">
            Detailed reports are maintained by the screening provider. Contact Match Fit support if you have questions
            about your result.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Certification uploads</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
          Each card matches a credential type: CPT, Registered Dietitian Nutritionist (RDN) and related nutrition
          credentials, another certified fitness specialist path, or an optional additional certificate. Verified
          badges appear after Match Fit approves the file.
        </p>
        <TrainerComplianceCertTracksForm
          initialTrackCpt={profile.onboardingTrackCpt}
          initialTrackNutrition={profile.onboardingTrackNutrition}
          initialTrackSpecialist={profile.onboardingTrackSpecialist}
          initialSpecialistRole={profile.specialistProfessionalRole}
          certificationReviewStatus={profile.certificationReviewStatus}
          nutritionistCertificationReviewStatus={profile.nutritionistCertificationReviewStatus}
          specialistCertificationReviewStatus={profile.specialistCertificationReviewStatus}
        />
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Review status by track</p>
          {profile.onboardingTrackCpt ? (
            <ComplianceReviewStatusRow title="CPT track" status={profile.certificationReviewStatus} statusLabel={cptLabel} />
          ) : null}
          {profile.onboardingTrackNutrition ? (
            <ComplianceReviewStatusRow
              title="Nutrition track"
              status={profile.nutritionistCertificationReviewStatus}
              statusLabel={nutLabel}
            />
          ) : null}
          {profile.onboardingTrackSpecialist ? (
            <ComplianceReviewStatusRow
              title="Specialist track"
              status={profile.specialistCertificationReviewStatus}
              statusLabel={specLabel}
            />
          ) : null}
          {!profile.onboardingTrackCpt &&
          !profile.onboardingTrackNutrition &&
          !profile.onboardingTrackSpecialist ? (
            <ComplianceReviewStatusRow
              title="Legacy credential"
              status={profile.certificationReviewStatus}
              statusLabel={cptLabel}
            />
          ) : null}
        </div>
        <TrainerComplianceCertCarousel
          onboardingTrackCpt={profile.onboardingTrackCpt}
          onboardingTrackNutrition={profile.onboardingTrackNutrition}
          onboardingTrackSpecialist={profile.onboardingTrackSpecialist}
          specialistProfessionalRole={profile.specialistProfessionalRole}
          certificationUrl={profile.certificationUrl}
          nutritionistCertificationUrl={profile.nutritionistCertificationUrl}
          specialistCertificationUrl={profile.specialistCertificationUrl}
          otherCertificationUrl={profile.otherCertificationUrl}
          certificationReviewStatus={profile.certificationReviewStatus}
          nutritionistCertificationReviewStatus={profile.nutritionistCertificationReviewStatus}
          specialistCertificationReviewStatus={profile.specialistCertificationReviewStatus}
          otherCertificationReviewStatus={profile.otherCertificationReviewStatus}
        />
        <TrainerComplianceCertReferenceDetails />
      </section>

      <p className="text-sm">
        <Link href="/trainer/dashboard" className="text-[#FF7E00] underline-offset-2 hover:underline">
          ← Back to Dashboard
        </Link>
      </p>
      </div>
    </div>
  );
}
