import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { backgroundCheckStatusLabel, certificationReviewStatusLabel } from "@/lib/trainer-compliance-status-copy";
import {
  isTrainerComplianceComplete,
  type TrainerComplianceProfileFields,
} from "@/lib/trainer-compliance-complete";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard | Trainer | Match Fit",
};

function StatusDot(props: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${props.ok ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-amber-400/90"}`}
      aria-hidden
    />
  );
}

function certificationReviewSubtitle(p: TrainerComplianceProfileFields | null): string {
  if (!p) return certificationReviewStatusLabel(undefined);
  if (certificationsGatePassed(p)) return "";
  const parts: string[] = [];
  if (p.onboardingTrackCpt) {
    parts.push(`CPT: ${certificationReviewStatusLabel(p.certificationReviewStatus)}`);
  }
  if (p.onboardingTrackNutrition) {
    parts.push(`Nutrition: ${certificationReviewStatusLabel(p.nutritionistCertificationReviewStatus)}`);
  }
  if (parts.length) return parts.join(" · ");
  return certificationReviewStatusLabel(p.certificationReviewStatus);
}

export default async function TrainerDashboardHomePage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      username: true,
      bio: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          dashboardActivatedAt: true,
          matchQuestionnaireStatus: true,
          aiMatchProfileText: true,
        },
      },
    },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }

  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";
  const profile = trainer.profile;

  const complianceComplete = isTrainerComplianceComplete(profile);

  const complianceRows = [
    {
      label: "Trainer Terms of Service",
      ok: Boolean(profile?.hasSignedTOS),
      line: (ok: boolean) => (ok ? "Complete" : "Action Needed"),
    },
    {
      label: "Background Check",
      ok: profile?.backgroundCheckStatus === "APPROVED",
      line: (ok: boolean) =>
        ok ? "Approved" : `Status: ${backgroundCheckStatusLabel(profile?.backgroundCheckStatus)}`,
    },
    {
      label: "W-9 on File",
      ok: Boolean(profile?.hasUploadedW9),
      line: (ok: boolean) => (ok ? "Complete" : "Action Needed"),
    },
    {
      label: "Certification Review",
      ok: profile ? certificationsGatePassed(profile) : false,
      line: (ok: boolean) => (ok ? "Complete" : `Status: ${certificationReviewSubtitle(profile)}`),
    },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Trainer Home</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome Back</h1>
        <p className="text-lg font-semibold text-white/90">{displayName}</p>
        <p className="max-w-xl text-sm leading-relaxed text-white/50">
          Signed in as <span className="text-white/75">@{trainer.username}</span>
        </p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:max-w-xl sm:p-7">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Quick Links</h2>
        <ul className="mt-4 space-y-2">
          <li>
            <Link
              href="/trainer/dashboard/settings"
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-[#FF7E00]/30 hover:bg-[#0E1016]"
            >
              Account Settings
              <span className="text-white/35" aria-hidden>
                →
              </span>
            </Link>
          </li>
          <li>
            {complianceComplete ? (
              <Link
                href="/trainer/dashboard/compliance"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-[#FF7E00]/30 hover:bg-[#0E1016]"
              >
                Compliance Details
                <span className="text-white/35" aria-hidden>
                  →
                </span>
              </Link>
            ) : (
              <Link
                href="/trainer/onboarding"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-[#FF7E00]/30 hover:bg-[#0E1016]"
              >
                Compliance Onboarding
                <span className="text-white/35" aria-hidden>
                  →
                </span>
              </Link>
            )}
          </li>
        </ul>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Biography</h2>
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
          <p className="text-sm font-medium leading-relaxed text-white/85">{trainer.bio?.trim() ? trainer.bio : "—"}</p>
        </div>
        <p className="mt-4 text-xs text-white/45">
          Phone and email can be updated in{" "}
          <Link href="/trainer/dashboard/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Account Settings
          </Link>
          . Edit your coach bio, demographics, social links, and photo there as well.
        </p>
        {profile?.dashboardActivatedAt ? (
          <p className="mt-2 text-xs font-semibold text-emerald-200/80">
            Dashboard is live since{" "}
            {profile.dashboardActivatedAt.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            .
          </p>
        ) : (
          <p className="mt-2 text-xs text-white/40">Finish compliance onboarding to go live on the platform.</p>
        )}
      </section>

      {profile?.matchQuestionnaireStatus === "completed" && profile.aiMatchProfileText ? (
        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Your Match Me Profile on File</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Plain-text profile for search and AI when pairing you with clients. Updates when you resubmit the
            questionnaire.
          </p>
          <pre className="mt-4 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-[#0E1016]/90 p-4 text-left text-xs leading-relaxed text-white/80">
            {profile.aiMatchProfileText}
          </pre>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Compliance Snapshot</h2>
        {complianceComplete ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm font-medium text-white/80">Compliance Completed</p>
            <p className="text-sm text-white/50">
              All required onboarding checks are satisfied. You can review agreements, your W-9, background check
              status, and uploaded certifications anytime.
            </p>
            <Link
              href="/trainer/dashboard/compliance"
              className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 sm:w-auto"
            >
              Review Compliance Details
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-3">
              {complianceRows.map((row) => (
                <li key={row.label} className="flex gap-3 rounded-xl border border-white/[0.05] bg-[#0E1016]/40 px-4 py-3">
                  <StatusDot ok={row.ok} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/85">{row.label}</p>
                    <p className="mt-0.5 text-xs text-white/45">{row.line(row.ok)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href="/trainer/onboarding"
                className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.09]"
              >
                Continue Compliance Onboarding
              </Link>
            </div>
          </>
        )}
      </section>

      <p className="text-sm">
        <Link href="/" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
