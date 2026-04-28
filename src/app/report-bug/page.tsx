import type { Metadata } from "next";
import Link from "next/link";
import { ClientBugReportForm } from "@/app/client/dashboard/(app)/bug-report/client-bug-report-form";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Report a Bug | Match Fit",
};

export default async function PublicBugReportPage() {
  const [trainerId, clientId] = await Promise.all([getSessionTrainerId(), getSessionClientId()]);
  const backHref = trainerId ? "/trainer/dashboard" : clientId ? "/client/dashboard" : "/";
  const backLabel = trainerId || clientId ? "Back to Dashboard" : "Back to Home";

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Support</p>
          <h1 className="text-3xl font-black tracking-[0.04em] text-white sm:text-4xl">Report a Bug</h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
            Share what happened so we can improve Match Fit reliability and product quality.
          </p>
        </header>
        <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <ClientBugReportForm />
        </section>
        <p className="text-center text-sm">
          <Link href={backHref} className="text-[#FF7E00] underline-offset-2 hover:underline">
            {backLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
