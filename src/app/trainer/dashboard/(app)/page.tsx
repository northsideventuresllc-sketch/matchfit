import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerDashboardLogoutLink } from "@/components/trainer/trainer-dashboard-logout-link";
import { TrainerDashboardServicesBubble } from "@/components/trainer/trainer-dashboard-services-bubble";
import { TrainerDashboardQuickActions } from "@/components/trainer/trainer-dashboard-quick-actions";
import { TrainerPremiumHubSummary } from "@/components/trainer/trainer-premium-hub-summary";
import { TrainerMatchAnswersPreview } from "@/components/trainer/trainer-match-answers-preview";
import { parseAiMatchProfileForDisplay } from "@/lib/ai-match-profile-parse";
import { prisma } from "@/lib/prisma";
import { trainerPublishedProfilePath } from "@/lib/trainer-public-profile-route";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard | Trainer | Match Fit",
};

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
          premiumStudioEnabledAt: true,
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

  const settingsHref = "/trainer/dashboard/settings";

  const matchBlocks =
    profile?.matchQuestionnaireStatus === "completed" && profile.aiMatchProfileText
      ? parseAiMatchProfileForDisplay(profile.aiMatchProfileText)
      : null;

  const premiumActive = Boolean(profile?.premiumStudioEnabledAt);

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

      <section className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="w-full rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:max-w-none sm:p-7">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Quick Links</h2>
          <div className="mt-6">
            <TrainerDashboardQuickActions />
          </div>
        </div>
      </section>

      <TrainerDashboardServicesBubble />

      <section className="mx-auto w-full max-w-2xl space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Premium Page</h2>
        <TrainerPremiumHubSummary variant="compact" />
        <div className="flex justify-center pt-1">
          <Link
            href="/trainer/dashboard/premium"
            className="inline-flex min-h-[2.75rem] w-full max-w-sm items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/18"
          >
            {premiumActive ? "Open premium hub" : "Explore premium enrollment"}
          </Link>
        </div>
      </section>

      <div className="flex justify-center">
        <Link
          href={trainerPublishedProfilePath(trainer.username)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[2.9rem] w-full max-w-md items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-5 text-sm font-semibold text-white transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/18"
        >
          See Profile
        </Link>
      </div>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Profile & visibility</h2>
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
        <div className="mx-auto mt-6 max-w-2xl space-y-2">
          {[
            ["Pronouns", trainer.pronouns],
            ["Ethnicity", trainer.ethnicity],
            ["Languages spoken", trainer.languagesSpoken],
            ["Fitness niches", trainer.fitnessNiches],
            ["Years of coaching", trainer.yearsCoaching],
            ["Gender identity", trainer.genderIdentity],
            ["Instagram", trainer.socialInstagram],
            ["TikTok", trainer.socialTiktok],
            ["Facebook", trainer.socialFacebook],
            ["LinkedIn", trainer.socialLinkedin],
            ["Other link", trainer.socialOtherUrl],
          ].map(([label, value]) => {
            const v = value?.trim();
            const isUrl = Boolean(v && /^https?:\/\//i.test(v));
            return (
              <div
                key={label}
                className="rounded-xl border border-white/[0.05] bg-[#0E1016]/50 px-4 py-3 sm:grid sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:items-start sm:gap-4 sm:py-3.5"
              >
                <div className="text-[11px] font-semibold text-white/40">{label}</div>
                <div className="mt-1 text-sm leading-relaxed text-white/85 sm:mt-0">
                  {v ? (
                    isUrl ? (
                      <a href={v} target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] underline-offset-2 hover:underline">
                        {v}
                      </a>
                    ) : (
                      <span className="whitespace-pre-wrap">{v}</span>
                    )
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">
          Onboarding Questionnaire answers
        </h2>
        <details className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
          <summary className="cursor-pointer list-none text-center text-sm font-semibold tracking-wide text-[#FF7E00]">
            SHOW ANSWERS
          </summary>
          <div className="mt-4">
            {matchBlocks ? (
              <TrainerMatchAnswersPreview blocks={matchBlocks} />
            ) : (
              <p className="text-center text-sm text-white/55">No Onboarding Questionnaire answers on file yet.</p>
            )}
          </div>
        </details>
      </section>

      <TrainerDashboardLogoutLink />
    </div>
  );
}
