import type { Metadata } from "next";
import { ClientBugReportForm } from "./client-bug-report-form";

export const metadata: Metadata = {
  title: "Report a Bug | Client | Match Fit",
};

export default function ClientBugReportPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Support</p>
        <h1 className="text-3xl font-black tracking-[0.04em] text-white sm:text-4xl">Report a Bug</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Tell us what is going wrong. You can include your name or submit anonymously. We use these reports to improve
          Match Fit reliability and product quality.
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientBugReportForm />
      </section>
    </div>
  );
}
