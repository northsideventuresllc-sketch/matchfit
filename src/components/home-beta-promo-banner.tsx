import Link from "next/link";
import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";
import { MATCH_FIT_PRODUCT_VERSION_ANNOUNCE } from "@/lib/match-fit-product-version";

export function HomeBetaPromoBanner() {
  const trainerFoundingCap = getTrainerFoundingBgPercentMax();

  return (
    <section
      id="beta-welcome"
      aria-labelledby="beta-welcome-heading"
      className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-[#FFD34E]/25 bg-[linear-gradient(135deg,rgba(255,211,78,0.14)_0%,rgba(255,126,0,0.1)_45%,rgba(227,43,43,0.12)_100%)] p-5 shadow-[0_24px_80px_-32px_rgba(255,126,0,0.4)] backdrop-blur-xl sm:p-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,211,78,0.35),transparent_68%)]"
      />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[#FFD34E]/40 bg-[#FFD34E]/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD34E]">
            Welcome to Match Fit
          </span>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            Version {MATCH_FIT_PRODUCT_VERSION_ANNOUNCE}
          </span>
        </div>

        <h1
          id="beta-welcome-heading"
          className="mt-4 max-w-3xl text-balance text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl md:text-[1.65rem]"
        >
          We are live — founding member promos active now
        </h1>

        <div className="mt-4 max-w-3xl space-y-3 text-pretty text-[15px] leading-relaxed text-white/65 sm:text-base">
          <p>
            Thank you for joining Match Fit! Match Fit is built to connect anyone looking to accomplish their
            fitness goals with the best fitness professionals that will help anyone get there.
          </p>
          <p>
            As of <span className="font-semibold text-white/85">May 21st, 2026</span>, Match Fit is{" "}
            <span className="font-bold text-[#FFD34E]">LIVE!</span> In Version {MATCH_FIT_PRODUCT_VERSION_ANNOUNCE}, we
            are rolling out the foundation of all the amazing features that this platform offers. Please know that there
            will be bugs and we encourage you to{" "}
            <Link
              href="/report-bug"
              className="font-semibold text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline"
            >
              report a bug
            </Link>{" "}
            with our <span className="font-semibold text-white/85">&ldquo;Report A Bug&rdquo;</span> feature at the
            bottom of the page. We also encourage you to{" "}
            <span className="font-semibold text-white/85">share your ideas</span> with us, so we can continuously bring
            features that are requested by none other than you!
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD34E]">
            Founding member promos — active until caps are reached
          </p>
          <ul className="list-none space-y-4">
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FFD34E,#FF7E00)]"
                aria-hidden
              />
              <span>
                <span className="font-semibold text-white/90">
                  First {trainerFoundingCap} fitness professionals:
                </span>{" "}
                your one-time onboarding fee will be{" "}
                <span className="font-bold text-[#FFD34E]">20% of the background check cost</span> instead of the
                background check fee being subtracted from the usual{" "}
                <span className="font-semibold text-white/75">$100.00 onboarding fee</span>.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FF7E00,#E32B2B)]"
                aria-hidden
              />
              <span>
                <span className="font-semibold text-white/90">All new clients:</span> complete sign-up and agree to the
                Terms of Service to start a{" "}
                <span className="font-bold text-[#FFD34E]">14-day free trial with no card required</span>. After the
                trial, you have <span className="font-bold text-[#FFD34E]">14 more days</span> to connect a card and
                subscribe before the account is deactivated.
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-4 max-w-3xl text-pretty text-sm leading-relaxed text-white/60 sm:text-[15px]">
          Once the caps are hit, you will be able to{" "}
          <span className="font-semibold text-white/85">reserve your username on a waitlist</span> until we open up the
          app to more people.
        </p>

        <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
          <span className="font-semibold text-[#FF7E00]/90">Beta rollout:</span> Anyone in the{" "}
          <span className="font-semibold text-white/60">United States</span> can create a client account during beta.{" "}
          <span className="font-semibold text-white/60">In-person sessions</span> with coaches are launching first in
          the <span className="font-semibold text-white/60">Atlanta metro area</span> (within approximately 15–20 miles
          of downtown Atlanta). Virtual coaching and nationwide discovery are available wherever the product supports
          them.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/promos"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_16px_40px_-16px_rgba(227,43,43,0.55)] transition hover:brightness-105"
          >
            View current promos
          </Link>
          <Link
            href="#follow-match-fit"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
          >
            Follow us for updates
          </Link>
        </div>
      </div>
    </section>
  );
}
