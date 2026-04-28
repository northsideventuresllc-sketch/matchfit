import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerDashboardBackgroundVisibility } from "@/components/trainer/trainer-dashboard-background-visibility";
import { TrainerDashboardLogoutLink } from "@/components/trainer/trainer-dashboard-logout-link";
import { TrainerMatchAnswersPreview } from "@/components/trainer/trainer-match-answers-preview";
import { parseAiMatchProfileForDisplay } from "@/lib/ai-match-profile-parse";
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
      pronouns: true,
      ethnicity: true,
      languagesSpoken: true,
      fitnessNiches: true,
      yearsCoaching: true,
      genderIdentity: true,
      socialInstagram: true,
      socialTiktok: true,
      socialFacebook: true,
      socialLinkedin: true,
      socialOtherUrl: true,
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

  const settingsHref = "/trainer/dashboard/settings";

  const matchBlocks =
    profile?.matchQuestionnaireStatus === "completed" && profile.aiMatchProfileText
      ? parseAiMatchProfileForDisplay(profile.aiMatchProfileText)
      : null;

  return (
    <div className="space-y-8">
      <header className="space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Trainer Home</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Welcome Back</h1>
        <p className="text-lg font-semibold text-white/90">{displayName}</p>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Signed in as <span className="text-white/75">@{trainer.username}</span>
        </p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Biography</h2>
        <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4 text-left">
          <p className="text-sm font-medium leading-relaxed text-white/85">{trainer.bio?.trim() ? trainer.bio : "—"}</p>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-white/45">
          Phone and email can be updated in{" "}
          <Link href={settingsHref} className="text-[#FF7E00] underline-offset-2 hover:underline">
            Account Settings
          </Link>
          . Edit your coach bio, demographics, social links, and photo there as well.
        </p>
        {profile?.dashboardActivatedAt ? (
          <p className="mx-auto mt-2 max-w-xl text-center text-xs font-semibold text-emerald-200/80">
            Dashboard is live since{" "}
            {profile.dashboardActivatedAt.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            .
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-xl text-center text-xs text-white/40">
            Finish compliance onboarding to go live on the platform.
          </p>
        )}
      </section>

      <TrainerDashboardBackgroundVisibility
        settingsHref={settingsHref}
        data={{
          pronouns: trainer.pronouns,
          ethnicity: trainer.ethnicity,
          languagesSpoken: trainer.languagesSpoken,
          fitnessNiches: trainer.fitnessNiches,
          yearsCoaching: trainer.yearsCoaching,
          genderIdentity: trainer.genderIdentity,
          socialInstagram: trainer.socialInstagram,
          socialTiktok: trainer.socialTiktok,
          socialFacebook: trainer.socialFacebook,
          socialLinkedin: trainer.socialLinkedin,
          socialOtherUrl: trainer.socialOtherUrl,
        }}
      />

      {matchBlocks ? (
        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Match Me answers</h2>
          <div className="mt-5">
            <TrainerMatchAnswersPreview blocks={matchBlocks} />
          </div>
          <p className="mt-5 text-center text-xs text-white/40">
            Editable from{" "}
            <Link href="/trainer/dashboard/match-questionnaire" className="text-[#FF7E00] underline-offset-2 hover:underline">
              match questionnaires
            </Link>
            .
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        {complianceComplete ? (
          <div className="mt-5 space-y-4 text-center">
            <p className="text-sm font-medium text-white/80">Compliance Completed</p>
            <p className="mx-auto max-w-lg text-sm text-white/50">
              All required onboarding checks are satisfied. You can review agreements, your W-9, background check
              status, and uploaded certifications anytime.
            </p>
            <div className="flex justify-center pt-1">
              <Link
                href="/trainer/dashboard/compliance"
                className="inline-flex min-h-[3rem] w-full max-w-md items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 sm:w-auto sm:min-w-[14rem]"
              >
                Review Compliance Details
              </Link>
            </div>
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
            <div className="mt-6 flex justify-center">
              <Link
                href="/trainer/onboarding"
                className="inline-flex min-h-[3rem] w-full max-w-md items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.09] sm:w-auto sm:min-w-[14rem]"
              >
                Continue Compliance Onboarding
              </Link>
            </div>
          </>
        )}
      </section>

      <TrainerDashboardLogoutLink />
    </div>
  );
}
