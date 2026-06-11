"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { OnboardingCertStatusLegend } from "@/app/trainer/onboarding/onboarding-cert-status-legend";
import { CREDIBLE_CPT_ORGANIZATIONS } from "@/app/trainer/onboarding/credible-cpt-organizations";
import { TrainerBackgroundCheckPlanBPanel } from "@/components/trainer/trainer-background-check-plan-b-panel";
import { TrainerBackgroundCheckStripePayment } from "@/components/trainer/trainer-background-check-stripe-payment";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { trainerHasSignupBackgroundEscrow } from "@/lib/trainer-background-check-ui";
import { TrainerComplianceCertTracksForm } from "@/components/trainer/trainer-compliance-cert-tracks-form";
import {
  SPECIALIST_ROLE_OPTIONS,
  type SpecialistProfessionalRoleId,
} from "@/lib/trainer-specialist-roles";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { coerceTrainerBackgroundVendorStatus, coerceTrainerCptStatus } from "@/lib/trainer-onboarding-status";
import type { TrainerComplianceWindowState } from "@/lib/trainer-compliance-window";
import { TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL } from "@/lib/trainer-signup-promo-copy";

type Props = {
  complianceWindow: TrainerComplianceWindowState;
  profile: {
    onboardingTrackCpt: boolean;
    onboardingTrackNutrition: boolean;
    onboardingTrackSpecialist: boolean;
    specialistProfessionalRole: string | null;
    backgroundCheckStatus: string;
    certificationReviewStatus: string;
    nutritionistCertificationReviewStatus: string;
    specialistCertificationReviewStatus: string;
    hasPaidBackgroundFee: boolean;
    registrationFeeHoldStatus?: string | null;
    backgroundCheckInviteRequestedAt?: string | null;
    backgroundCheckInviteSentAt?: string | null;
  };
  matchQuestionnaireStatus: string;
};

export function TrainerDashboardComplianceOnboarding({
  complianceWindow,
  profile,
  matchQuestionnaireStatus,
}: Props) {
  const [pathCpt, setPathCpt] = useState(profile.onboardingTrackCpt);
  const [pathNutrition, setPathNutrition] = useState(profile.onboardingTrackNutrition);
  const [pathSpecialist, setPathSpecialist] = useState(profile.onboardingTrackSpecialist);
  const [specialistRole, setSpecialistRole] = useState<SpecialistProfessionalRoleId>(
    (profile.specialistProfessionalRole as SpecialistProfessionalRoleId) || "cscs",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const bgStatus = coerceTrainerBackgroundVendorStatus(profile.backgroundCheckStatus);
  const certsOk = certificationsGatePassed({
    onboardingTrackCpt: pathCpt,
    onboardingTrackNutrition: pathNutrition,
    onboardingTrackSpecialist: pathSpecialist,
    certificationReviewStatus: profile.certificationReviewStatus,
    nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
    specialistCertificationReviewStatus: profile.specialistCertificationReviewStatus,
  });

  const refresh = useCallback(async () => {
    setReloadKey((k) => k + 1);
    window.location.reload();
  }, []);

  async function saveProfessionalPath() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/onboarding/professional-path", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackCpt: pathCpt,
          trackNutrition: pathNutrition,
          trackSpecialist: pathSpecialist,
          specialistProfessionalRole: pathSpecialist ? specialistRole : undefined,
          confirmAck: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your professional path.");
        return;
      }
      await refresh();
    } catch {
      setError("Could not save your professional path.");
    } finally {
      setBusy(false);
    }
  }

  const pathSelected = pathCpt || pathNutrition || pathSpecialist;
  const questionnaireDone = matchQuestionnaireStatus === "completed";

  if (complianceWindow.expired) {
    return (
      <section className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <h2 className="text-lg font-black text-rose-100">Compliance window ended</h2>
        <p className="mt-2 text-sm text-white/70">
          Your certification and screening window has closed. Contact{" "}
          <a href="mailto:support@match-fit.net" className="text-[#FF7E00] underline">
            support@match-fit.net
          </a>{" "}
          if you believe this is an error.
        </p>
      </section>
    );
  }

  return (
    <section
      key={reloadKey}
      className="rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(145deg,rgba(255,126,0,0.12),rgba(18,21,28,0.95))] p-6 shadow-[0_30px_80px_-40px_rgba(255,126,0,0.35)] sm:p-8"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Finish setup</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
        Certification &amp; background screening
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
        Upload your credentials and complete Checkr screening to unlock messaging, services, and client discovery. Pay
        your background check through our portal during the founding promo—there is no {TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL}{" "}
        platform registration fee while the promo is active. You cannot sell or offer services until every requirement
        is approved.
      </p>

      {complianceWindow.paused && !complianceWindow.humanReviewActive ? (
        <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
          Both uploads are in review — your 7-day timer is paused while Match Fit and Checkr process results.
        </p>
      ) : complianceWindow.daysRemaining != null ? (
        <p className="mt-4 text-sm font-semibold text-amber-100/90">
          About {complianceWindow.daysRemaining} day{complianceWindow.daysRemaining === 1 ? "" : "s"} left in your
          compliance window.
        </p>
      ) : null}

      {complianceWindow.humanReviewActive ? (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
          Your background check needs a confidential review with Match Fit staff. You have until{" "}
          {complianceWindow.humanReviewDeadlineAt?.toLocaleDateString(undefined, { dateStyle: "long" }) ??
            "the deadline in your email"}{" "}
          to work with our team on a final decision.
        </p>
      ) : null}

      {!questionnaireDone ? (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 p-4">
          <p className="text-sm font-semibold text-white/85">Onboarding Questionnaire (required)</p>
          <p className="mt-1 text-xs text-white/50">
            Complete this for client matching. It does not count against your 7-day certification and screening timer.
          </p>
          <Link
            href="/trainer/dashboard/match-questionnaire"
            className="mt-3 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white"
          >
            Open questionnaire
          </Link>
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/80 p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-white/70">1. Professional path</h3>
          {!pathSelected ? (
            <div className="mt-4 space-y-3 text-sm text-white/65">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pathCpt} onChange={(e) => setPathCpt(e.target.checked)} className="accent-[#FF7E00]" />
                CPT / personal training ({CREDIBLE_CPT_ORGANIZATIONS.length}+ accepted orgs)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pathNutrition}
                  onChange={(e) => setPathNutrition(e.target.checked)}
                  className="accent-[#FF7E00]"
                />
                Nutrition credentials
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pathSpecialist}
                  onChange={(e) => setPathSpecialist(e.target.checked)}
                  className="accent-[#FF7E00]"
                />
                Specialist (CSCS, CES, group fitness)
              </label>
              {pathSpecialist ? (
                <select
                  value={specialistRole}
                  onChange={(e) => setSpecialistRole(e.target.value as SpecialistProfessionalRoleId)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
                >
                  {SPECIALIST_ROLE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                disabled={busy || !pathSelected}
                onClick={() => void saveProfessionalPath()}
                className="mt-2 rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save path"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-emerald-200/80">Path saved — upload credentials below.</p>
          )}
        </div>

        {pathSelected ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/80 p-5">
            <h3 className="text-sm font-black uppercase tracking-wide text-white/70">2. Certifications</h3>
            <OnboardingCertStatusLegend title="Certification review statuses" />
            <div className="mt-4">
              <TrainerComplianceCertTracksForm
                initialTrackCpt={pathCpt}
                initialTrackNutrition={pathNutrition}
                initialTrackSpecialist={pathSpecialist}
                initialSpecialistRole={profile.specialistProfessionalRole}
                certificationReviewStatus={profile.certificationReviewStatus}
                nutritionistCertificationReviewStatus={profile.nutritionistCertificationReviewStatus}
                specialistCertificationReviewStatus={profile.specialistCertificationReviewStatus}
              />
            </div>
            <p className="mt-3 text-xs text-white/45">
              CPT status: {coerceTrainerCptStatus(profile.certificationReviewStatus)}
              {profile.onboardingTrackNutrition
                ? ` · Nutrition: ${coerceTrainerCptStatus(profile.nutritionistCertificationReviewStatus)}`
                : ""}
            </p>
          </div>
        ) : null}

        {pathSelected ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/80 p-5">
            <h3 className="text-sm font-black uppercase tracking-wide text-white/70">3. Background screening (Checkr)</h3>
            <p className="mt-2 text-sm text-white/55">
              Status: <span className="font-semibold text-white">{bgStatus.replace(/_/g, " ")}</span>
            </p>
            {bgStatus === "NOT_STARTED" || bgStatus === "PENDING" ? (
              <div className="mt-4">
                {isBackgroundCheckPlanBActive() ? (
                  <TrainerBackgroundCheckPlanBPanel
                    backgroundCheckStatus={profile.backgroundCheckStatus}
                    inviteRequestedAt={profile.backgroundCheckInviteRequestedAt ?? null}
                    inviteSentAt={profile.backgroundCheckInviteSentAt ?? null}
                    signupEscrowActive={trainerHasSignupBackgroundEscrow({
                      registrationFeeHoldStatus: profile.registrationFeeHoldStatus,
                      hasPaidBackgroundFee: profile.hasPaidBackgroundFee,
                    })}
                    compact
                  />
                ) : !profile.hasPaidBackgroundFee &&
                  !trainerHasSignupBackgroundEscrow({
                    registrationFeeHoldStatus: profile.registrationFeeHoldStatus,
                    hasPaidBackgroundFee: profile.hasPaidBackgroundFee,
                  }) ? (
                  <TrainerBackgroundCheckStripePayment
                    amountLabel="Background screening fee"
                    onPaid={() => refresh()}
                    onError={(m) => setError(m)}
                  />
                ) : (
                  <p className="text-sm text-white/60">
                    Signup fee hold includes screening. Complete your Checkr invitation from email, or contact support if
                    you need a new link.
                  </p>
                )}
              </div>
            ) : bgStatus === "APPROVED" ? (
              <p className="mt-3 text-sm text-emerald-200/85">Background screening cleared.</p>
            ) : null}
          </div>
        ) : null}

        {certsOk && bgStatus === "APPROVED" ? (
          <p className="text-center text-sm font-semibold text-emerald-200/90">
            Compliance approved — full platform access unlocks after we capture your held signup fee.
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
