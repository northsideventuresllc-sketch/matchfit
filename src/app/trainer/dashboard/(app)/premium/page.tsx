import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PremiumSignupClient } from "./premium-signup-client";
import { TrainerPremiumHubSummary } from "@/components/trainer/trainer-premium-hub-summary";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Premium Page | Trainer | Match Fit",
};

export default async function TrainerPremiumSignupPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });

  const active = Boolean(profile?.premiumStudioEnabledAt);

  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Growth</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Premium Page</h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/55">
          {active ? (
            <>
              One hub for featured placement, Fit Hub publishing, and promotion tokens—each destination below focuses on
              a single job so you are not hunting through tabs. Like programming or cues, visibility works best when it is
              deliberate: a modest investment in those surfaces helps the right clients find you before you get lost in the
              scroll.
            </>
          ) : (
            <>
              One hub for featured placement, Fit Hub publishing, and promotion tokens once you enroll. When you are
              ready, the same tools become part of how you run the business—not just a badge—so the clients who fit you
              actually see your work.
            </>
          )}
        </p>
      </header>

      {active ? (
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          <Link
            href="/trainer/dashboard/premium/featured"
            className="group flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.1] bg-[#12151C]/90 px-5 py-6 text-center transition hover:border-[#FF7E00]/35"
          >
            <p className="text-base font-semibold text-white">Featured Trainer</p>
            <p className="text-sm font-semibold text-[#FF7E00]">Placement &amp; Auctions</p>
            <p className="max-w-[14rem] text-xs leading-relaxed text-white/45">
              Eligibility, daily entry, and bidding for featured windows.
            </p>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 group-hover:text-white/55">
              Open →
            </span>
          </Link>

          <Link
            href="/trainer/dashboard/premium/fit-hub-content"
            className="group flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.1] bg-[#12151C]/90 px-5 py-6 text-center transition hover:border-[#FF7E00]/35"
          >
            <p className="text-base font-semibold text-white">Fit Hub &amp; Content</p>
            <p className="text-sm font-semibold text-[#FF7E00]">Content Creation</p>
            <p className="max-w-[14rem] text-xs leading-relaxed text-white/45">
              Composer for posts and the full library for edits and visibility.
            </p>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 group-hover:text-white/55">
              Open →
            </span>
          </Link>

          <Link
            href="/trainer/dashboard/premium/promo-tokens"
            className="group flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.1] bg-[#12151C]/90 px-5 py-6 text-center transition hover:border-[#FF7E00]/35"
          >
            <p className="text-base font-semibold text-white">Promotion Tokens</p>
            <p className="text-sm font-semibold text-[#FF7E00]">Token Balance &amp; FitHub Boost</p>
            <p className="max-w-[14rem] text-xs leading-relaxed text-white/45">
              Weekly grants, packs, and regional video promotions.
            </p>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 group-hover:text-white/55">
              Open →
            </span>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8">
          <PremiumSignupClient />
        </div>
      )}

      <TrainerPremiumHubSummary variant="full" />

      <div className="flex justify-center pt-4">
        <Link
          href="/trainer/dashboard"
          className="inline-flex min-h-[3rem] w-full max-w-md items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-xs font-black uppercase tracking-[0.1em] text-white/90 transition hover:border-white/25"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
