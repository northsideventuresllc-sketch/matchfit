import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
      email: true,
      phone: true,
      username: true,
      bio: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
          hasPaidBackgroundFee: true,
          backgroundCheckStatus: true,
          certificationReviewStatus: true,
          backgroundCheckReviewStatus: true,
          dashboardActivatedAt: true,
          matchQuestionnaireStatus: true,
          matchQuestionnaireCompletedAt: true,
          aiMatchProfileText: true,
        },
      },
    },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }

  const displayName = [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() || "Trainer";
  const profile = trainer.profile;
  const questionnaireLabel =
    profile?.matchQuestionnaireStatus === "completed"
      ? "Completed"
      : profile?.matchQuestionnaireStatus === "in_progress"
        ? "In progress"
        : "Not started";

  return (
    <>
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Dashboard</h1>
      <p className="mt-2 text-lg font-semibold text-white/85">Welcome back, {displayName}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Signed in as <span className="text-white/80">{trainer.email}</span>
        {trainer.username ? (
          <>
            {" "}
            · <span className="text-white/70">@{trainer.username}</span>
          </>
        ) : null}
      </p>

      <section className="mt-8 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Your profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-white/45">Phone</dt>
            <dd className="font-medium text-white/90">{trainer.phone || "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-white/45">Bio</dt>
            <dd className="max-w-md text-right font-medium text-white/90 sm:text-right">
              {trainer.bio?.trim() ? trainer.bio : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-white/45">Dashboard profile</dt>
            <dd className="font-medium text-white/90">
              {profile?.dashboardActivatedAt
                ? `Activated ${profile.dashboardActivatedAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Complete onboarding (including background check) to activate"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(135deg,rgba(255,126,0,0.12),rgba(227,43,43,0.08))] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h2 className="text-lg font-black tracking-tight text-white">Match Me</h2>
          <span className="rounded-full border border-amber-400/45 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100">
            Required onboarding
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Finish this once so client search and our matcher can read who you coach, what you charge, where you meet
          people, and how you work.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/45">
          Status: {questionnaireLabel}
          {profile?.matchQuestionnaireCompletedAt
            ? ` · Last submitted ${profile.matchQuestionnaireCompletedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}`
            : null}
        </p>
        <div className="mt-6">
          <Link
            href="/trainer/dashboard/match-questionnaire"
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/20 bg-[#0E1016]/80 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/35 hover:bg-[#0E1016]"
          >
            {profile?.matchQuestionnaireStatus === "completed" ? "Update Match Me" : "Complete Match Me"}
          </Link>
        </div>
      </section>

      {profile?.matchQuestionnaireStatus === "completed" && profile.aiMatchProfileText ? (
        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">Your Match Me — on file</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            This is the plain-text profile we store for search and AI when pairing you with clients. It updates whenever
            you resubmit the questionnaire.
          </p>
          <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-[#0E1016]/90 p-4 text-left text-xs leading-relaxed text-white/80">
            {profile.aiMatchProfileText}
          </pre>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Compliance snapshot</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/65">
          <li>Terms of service (trainer): {profile?.hasSignedTOS ? "Yes" : "No"}</li>
          <li>W-9 on file: {profile?.hasUploadedW9 ? "Yes" : "No"}</li>
          <li>Background fee (skeleton): {profile?.hasPaidBackgroundFee ? "Recorded" : "No"}</li>
          <li>Background check: {profile?.backgroundCheckStatus ?? "—"}</li>
          <li>Certification review: {profile?.certificationReviewStatus ?? "—"}</li>
          <li>Background review: {profile?.backgroundCheckReviewStatus ?? "—"}</li>
        </ul>
        <div className="mt-6">
          <Link
            href="/trainer/onboarding"
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.09]"
          >
            Continue compliance onboarding
          </Link>
        </div>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </>
  );
}
