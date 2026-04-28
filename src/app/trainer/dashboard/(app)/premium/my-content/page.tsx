import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPremiumMyContentClient } from "./trainer-premium-my-content-client";

export const metadata: Metadata = {
  title: "My Content | Premium | Trainer | Match Fit",
};

export default async function TrainerPremiumMyContentPage() {
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
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium Page</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">My Content</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Everything you have published or scheduled for FitHub. Open a post to share it, delete it, or switch visibility.
        </p>
        <p className="text-xs text-white/40">
          <Link href="/trainer/dashboard/premium/studio" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Premium Studio
          </Link>
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <TrainerPremiumMyContentClient />
      </section>
    </div>
  );
}
