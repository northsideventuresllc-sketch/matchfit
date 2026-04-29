import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

export default async function TermsPage() {
  const clientId = await getSessionClientId();
  const trainerId = await getSessionTrainerId();
  const role = clientId ? "client" : trainerId ? "trainer" : "guest";

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Terms of Service</h1>
        <p className="mt-6 text-sm leading-relaxed text-white/60">
          This is a placeholder page. Replace this content with your legal Terms of Service
          before inviting users to accept them at sign-up.
        </p>

        <section id="featured-placement" className="mt-12 scroll-mt-24 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-lg font-black tracking-tight">Featured home placement (trainers)</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Premium Page coaches may participate in a regional program to appear in the public “featured trainers” module.
            The program has two parts: (1) a <strong className="text-white/80">daily random allocation</strong> among
            eligible entrants in the same three-digit US ZIP prefix derived from the coach’s published in-person service
            ZIP, and (2) up to two <strong className="text-white/80">sponsored placements</strong> per region per day
            awarded to the highest binding bids. Cutoffs and display windows use the <strong className="text-white/80">America/New_York</strong>{" "}
            calendar unless Match Fit posts a different schedule.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Sponsored bids are <strong className="text-white/80">payments for advertising</strong>, not wagers, stakes,
            or games of chance. Amounts you commit are <strong className="text-white/80">non-refundable</strong> once the
            placement window locks, even if you are later outranked, your profile is removed for policy reasons, or traffic
            is lower than expected. Match Fit does not guarantee impressions, inquiries, or revenue.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            The raffle leg is a <strong className="text-white/80">no-additional-charge</strong> benefit for qualifying
            Premium coaches in the stated pool. Where required, Match Fit provides a <strong className="text-white/80">free alternate method of entry</strong>{" "}
            at no charge beyond what the official rules describe. The program is void where prohibited; coaches are
            responsible for complying with local promotions, sweepstakes, and advertising laws.
          </p>
          <p className="mt-3 text-xs text-white/45">
            Replace this summary with counsel-approved language before launch.
          </p>
        </section>

        <LegalPageFooterNav role={role} />
      </div>
    </main>
  );
}
