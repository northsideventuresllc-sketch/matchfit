import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerPremiumHubBackLink } from "@/components/trainer/trainer-premium-hub-summary";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPremiumMyContentClient } from "../my-content/trainer-premium-my-content-client";
import { TrainerPremiumStudioClient } from "../studio/trainer-premium-studio-client";

export const metadata: Metadata = {
  title: "Fit Hub & Content | Premium | Trainer | Match Fit",
};

export default async function TrainerPremiumFitHubContentPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  if (!profile?.premiumStudioEnabledAt) {
    redirect("/trainer/dashboard/premium");
  }

  return (
    <div className="space-y-10">
      <TrainerPremiumHubBackLink />

      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium · Fit Hub</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Create &amp; manage content</h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/55">
          Build posts for the client Fit Hub feed—photos, video, check-ins, and carousels—with optional scheduling. Below
          that, My Content is your library for everything published or queued: share, privatize, or delete in one place.
        </p>
      </header>

      <section className="space-y-6">
        <TrainerPremiumStudioClient />
      </section>

      <section id="my-content" className="scroll-mt-24 space-y-4 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">My content</p>
          <h2 className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-white/90">Library &amp; visibility</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">
            Everything you have published or scheduled. Open a row to share, toggle visibility, or remove a post.
          </p>
        </div>
        <TrainerPremiumMyContentClient embedded />
      </section>

      <p className="text-center text-xs text-white/40">
        <Link href="/trainer/dashboard/premium" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Premium hub
        </Link>
      </p>
    </div>
  );
}
