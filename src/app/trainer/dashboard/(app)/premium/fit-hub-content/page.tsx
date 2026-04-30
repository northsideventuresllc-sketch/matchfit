import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PremiumStudioLockedNotice } from "@/components/trainer/premium-studio-locked";
import { TrainerFitHubStudioNotifications } from "@/components/trainer/trainer-fithub-studio-notifications";
import { TrainerPremiumHubBackLink } from "@/components/trainer/trainer-premium-hub-summary";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPremiumMyContentClient } from "../my-content/trainer-premium-my-content-client";
import { TrainerPremiumStudioClient } from "../studio/trainer-premium-studio-client";

export const metadata: Metadata = {
  title: "FitHub & Content | Premium | Trainer | Match Fit",
};

export default async function TrainerPremiumFitHubContentPage() {
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
        <PremiumStudioLockedNotice areaLabel="FitHub & Content" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <TrainerPremiumHubBackLink />

      <header className="space-y-2 text-center">
        <p className="text-xs font-black tracking-[0.22em] text-white/55">PREMIUM HUB</p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium · FitHub</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Create &amp; manage content</h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/55">
          Build posts for the client FitHub feed—photos, video, check-ins, and carousels—with optional scheduling. Below
          that, My Content is your library for everything published or queued: share, privatize, or delete in one place.
        </p>
      </header>

      <TrainerFitHubStudioNotifications />

      <section className="space-y-6">
        <TrainerPremiumStudioClient showFeaturedListing={false} />
      </section>

      <section
        id="my-content"
        className="scroll-mt-24 space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8"
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">My content</p>
          <h2 className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-white/90">Library &amp; visibility</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">
            Thumbnails, engagement, and quick actions for everything you have published or scheduled. Tap a row for full
            controls, or open comments to read the thread.
          </p>
        </div>
        <TrainerPremiumMyContentClient embedded />
      </section>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
        <Link href="/trainer/dashboard/premium/featured" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Featured Trainer
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
