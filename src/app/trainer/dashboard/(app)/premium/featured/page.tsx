import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeaturedListingStudioPanel } from "@/components/trainer/featured-listing-studio-panel";
import { PremiumStudioLockedNotice } from "@/components/trainer/premium-studio-locked";
import { TrainerPremiumHubBackLink } from "@/components/trainer/trainer-premium-hub-summary";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Featured Trainer | Premium | Trainer | Match Fit",
};

export default async function TrainerPremiumFeaturedPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  const active = Boolean(profile?.premiumStudioEnabledAt);

  if (!active) {
    return (
      <div className="space-y-8">
        <TrainerPremiumHubBackLink />
        <PremiumStudioLockedNotice areaLabel="Featured Trainer" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TrainerPremiumHubBackLink />

      <header className="space-y-2 text-center">
        <p className="text-xs font-black tracking-[0.22em] text-white/55">PREMIUM HUB</p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium · Discovery</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Featured Trainer</h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/55">
          Check eligibility, enter the daily pool, and manage bids when auctions are open. This is separate from FitHub
          posting—here you are competing for placement when the product runs featured windows.
        </p>
      </header>

      <FeaturedListingStudioPanel />

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
        <Link href="/trainer/dashboard/premium/fit-hub-content" className="text-[#FF7E00] underline-offset-2 hover:underline">
          FitHub &amp; Content
        </Link>
        <span className="text-white/25" aria-hidden>
          ·
        </span>
        <Link href="/trainer/dashboard/premium/promo-tokens" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Promotion Tokens
        </Link>
      </p>
    </div>
  );
}
