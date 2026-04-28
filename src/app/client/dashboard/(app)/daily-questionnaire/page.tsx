import type { Metadata } from "next";
import { ClientDailyQuestionnaireClient } from "./client-daily-questionnaire-client";

export const metadata: Metadata = {
  title: "Daily questionnaire | Client | Match Fit",
};

export default function ClientDailyQuestionnairePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Matching</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Daily questionnaire</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Three short prompts, refreshed at most every 24 hours after you submit. Each set is built from your profile,
          your ZIP region, and coaches who recently joined the platform so we can tune recommendations for you.
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientDailyQuestionnaireClient />
      </section>
    </div>
  );
}
