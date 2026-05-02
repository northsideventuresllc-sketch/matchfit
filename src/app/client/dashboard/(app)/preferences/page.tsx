import type { Metadata } from "next";
import Link from "next/link";
import { ClientMatchPreferencesForm } from "@/components/client/client-match-preferences-form";

export const metadata: Metadata = {
  title: "Match preferences | Client | Match Fit",
};

export default function ClientDashboardPreferencesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Targeting</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Match preferences</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          These answers power coach ranking, relaxed search, and what shows on your public profile cards. Update them
          whenever your goals shift.
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientMatchPreferencesForm mode="settings" />
      </section>
      <p className="text-center text-xs text-white/40">
        Need to tweak your name, bio, or photo?{" "}
        <Link href="/client/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Account Settings
        </Link>
      </p>
    </div>
  );
}
