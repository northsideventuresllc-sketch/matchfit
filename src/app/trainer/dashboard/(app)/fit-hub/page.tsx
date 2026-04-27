import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Fit Hub | Trainer | Match Fit",
};

export default async function TrainerFitHubPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  const isPremium = Boolean(profile?.premiumStudioEnabledAt);

  if (!isPremium) {
    return (
      <div className="space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Fit Hub</p>
          <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Premium only</h1>
        </header>
        <div className="mx-auto max-w-lg rounded-3xl border border-amber-400/30 bg-amber-400/10 px-6 py-8 text-center">
          <p className="text-sm leading-relaxed text-white/80">
            Only premium trainers can access Fit Hub—where you post photos, videos, and updates for clients to see.
          </p>
          <Link
            href="/trainer/dashboard/premium"
            className="mt-6 inline-flex min-h-[3rem] w-full max-w-xs items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/15 px-5 text-sm font-semibold text-white transition hover:border-[#FF7E00]/60 hover:bg-[#FF7E00]/25"
          >
            Sign up for premium subscription
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Fit Hub</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Your posts</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          This is your posting area for client-facing content. A full composer and feed will replace this placeholder in
          a follow-up release.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {["New post", "Scheduled drafts"].map((label) => (
          <div
            key={label}
            className="flex min-h-[10rem] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.12] bg-[#12151C]/80 p-6 text-center"
          >
            <p className="text-sm font-semibold text-white/65">{label}</p>
            <p className="mt-2 text-xs text-white/35">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  );
}
