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
          One hub for premium tools: featured placement, Fit Hub publishing, and promotion tokens. Open a destination
          below—each page focuses on a single job so you are never hunting through tabs.
        </p>
      </header>

      <TrainerPremiumHubSummary variant="full" />

      {active ? (
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          <Link
            href="/trainer/dashboard/premium/featured"
            className="group flex min-h-[10rem] flex-col justify-between rounded-3xl border border-[#FF7E00]/25 bg-gradient-to-br from-[#FF7E00]/[0.12] to-[#12151C]/95 p-5 text-left shadow-[0_24px_60px_-28px_rgba(255,126,0,0.35)] transition hover:border-[#FF7E00]/45"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF7E00]/95">Featured Trainer</p>
              <p className="mt-3 text-sm font-semibold text-white/90">Placement &amp; auctions</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Eligibility, daily entry, and bidding for featured windows.
              </p>
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/45 group-hover:text-white/70">
              Open →
            </span>
          </Link>

          <Link
            href="/trainer/dashboard/premium/fit-hub-content"
            className="group flex min-h-[10rem] flex-col justify-between rounded-3xl border border-white/[0.1] bg-[#12151C]/90 p-5 text-left transition hover:border-white/20"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Fit Hub &amp; content</p>
              <p className="mt-3 text-sm font-semibold text-white/90">Create + My Content</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Composer for posts and the full library for edits and visibility.
              </p>
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/45 group-hover:text-white/70">
              Open →
            </span>
          </Link>

          <Link
            href="/trainer/dashboard/premium/promo-tokens"
            className="group flex min-h-[10rem] flex-col justify-between rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-[#12151C]/95 p-5 text-left transition hover:border-emerald-400/40"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/90">Promotion tokens</p>
              <p className="mt-3 text-sm font-semibold text-white/90">Balance &amp; boosts</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Weekly grants, packs, and regional video promotions.
              </p>
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/45 group-hover:text-white/70">
              Open →
            </span>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8">
          <PremiumSignupClient />
        </div>
      )}

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
