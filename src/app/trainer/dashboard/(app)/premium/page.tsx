import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PremiumSignupClient } from "./premium-signup-client";
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
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Growth</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Premium Page</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Build a richer presence with a feed-style layout. More commerce and media tools will land in a follow-up
          pass.
        </p>
      </header>

      {active ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center">
          <p className="text-sm text-white/70">You&apos;re enrolled in Premium Page.</p>
          <Link
            href="/trainer/dashboard/premium/studio"
            className="mt-4 inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-6 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-[#FF7E00]/55"
          >
            Open Premium studio
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8">
          <PremiumSignupClient />
        </div>
      )}
    </div>
  );
}
