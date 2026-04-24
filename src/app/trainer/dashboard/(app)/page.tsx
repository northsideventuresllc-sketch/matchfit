import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
      email: true,
      phone: true,
      username: true,
      bio: true,
      profile: {
        select: {
          hasSignedTOS: true,
          hasUploadedW9: true,
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

  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";
  const profile = trainer.profile;
  const questionnaireLabel =
    profile?.matchQuestionnaireStatus === "completed"
      ? "Completed"
      : profile?.matchQuestionnaireStatus === "in_progress"
        ? "In Progress"
        : "Not Started";

  const complianceRows = [
    { label: "Trainer terms of service", ok: Boolean(profile?.hasSignedTOS) },
    { label: "W-9 on file", ok: Boolean(profile?.hasUploadedW9) },
    {
      label: "Background check",
      ok: profile?.backgroundCheckStatus === "APPROVED",
      detail: profile?.backgroundCheckStatus ?? "—",
    },
    {
      label: "Certification review",
      ok: profile?.certificationReviewStatus === "APPROVED",
      detail: profile?.certificationReviewStatus ?? "—",
    },
    {
      label: "Background review",
      ok: profile?.backgroundCheckReviewStatus === "APPROVED",
      detail: profile?.backgroundCheckReviewStatus ?? "—",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Trainer Home</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome back</h1>
        <p className="text-lg font-semibold text-white/90">{displayName}</p>
        <p className="max-w-xl text-sm leading-relaxed text-white/50">
          Signed in as <span className="text-white/75">{trainer.email}</span>
          {trainer.username ? (
            <>
              {" "}
              · <span className="text-white/65">@{trainer.username}</span>
            </>
          ) : null}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-7">
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
              <Link
                href="/trainer/dashboard/match-questionnaire"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-[#FF7E00]/30 hover:bg-[#0E1016]"
              >
                Match Me Questionnaire
                <span className="text-white/35" aria-hidden>
                  →
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/trainer/onboarding"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-[#FF7E00]/30 hover:bg-[#0E1016]"
              >
                Compliance Onboarding
                <span className="text-white/35" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section className="rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(145deg,rgba(255,126,0,0.14),rgba(227,43,43,0.08))] p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-white">Match Me</h2>
            <span className="rounded-full border border-amber-400/45 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100">
              Client Matching
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            One structured profile so search and our matcher understand how you coach, what you charge, and where you
            meet clients.
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
          <div className="mt-5">
            <Link
              href="/trainer/dashboard/match-questionnaire"
              className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/20 bg-[#0E1016]/80 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/35 hover:bg-[#0E1016]"
            >
              {profile?.matchQuestionnaireStatus === "completed" ? "Update Match Me" : "Complete Match Me"}
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Profile Snapshot</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Phone</dt>
            <dd className="mt-1 text-sm font-medium text-white/90">{trainer.phone || "—"}</dd>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Dashboard status</dt>
            <dd className="mt-1 text-sm font-medium text-white/90">
              {profile?.dashboardActivatedAt
                ? `Live since ${profile.dashboardActivatedAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Finish onboarding (including background check) to go live"}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Bio</dt>
            <dd className="mt-1 text-sm font-medium leading-relaxed text-white/85">
              {trainer.bio?.trim() ? trainer.bio : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-xs text-white/40">
          Edit your coach bio, demographics, social links, and photo in{" "}
          <Link href="/trainer/dashboard/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Account Settings
          </Link>
          .
        </p>
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
        <ul className="mt-5 space-y-3">
          {complianceRows.map((row) => (
            <li key={row.label} className="flex gap-3 rounded-xl border border-white/[0.05] bg-[#0E1016]/40 px-4 py-3">
              <StatusDot ok={row.ok} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/85">{row.label}</p>
                {"detail" in row ? (
                  <p className="mt-0.5 text-xs text-white/45">
                    {row.ok ? "Cleared" : `Status: ${row.detail}`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-white/45">{row.ok ? "Complete" : "Action needed"}</p>
                )}
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
      </section>

      <p className="text-sm">
        <Link href="/" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
