import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientMatchPreferencesForm } from "@/components/client/client-match-preferences-form";
import { ClientPortalHeader } from "@/components/client/client-portal-header";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Match preferences | Client | Match Fit",
};

export default async function ClientPreferencesOnboardingPage() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client?next=%2Fclient%2Fdashboard%2Fpreferences%2Fonboarding");
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      profileImageUrl: true,
      matchPreferencesCompletedAt: true,
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }
  if (client.matchPreferencesCompletedAt) {
    redirect("/client/dashboard");
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#07080C] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-xl">
        <ClientPortalHeader preferredName={client.preferredName} profileImageUrl={client.profileImageUrl} />
        <header className="mb-8 space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">First-time setup</p>
          <h1 className="text-2xl font-black uppercase tracking-[0.06em] sm:text-3xl">Match preferences</h1>
          <p className="text-sm leading-relaxed text-white/50">
            Tell Match Fit what you are looking for so we can rank coaches, power search, and (optionally) let verified
            trainers discover your public profile.
          </p>
        </header>
        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <ClientMatchPreferencesForm mode="onboarding" />
        </section>
        <p className="mt-8 text-center text-xs text-white/40">
          Need to sign out?{" "}
          <Link href="/client/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Account Settings
          </Link>
        </p>
      </div>
    </main>
  );
}
