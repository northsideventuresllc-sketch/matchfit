"use client";

import Link from "next/link";
import { MATCH_FIT_PRODUCT_VERSION_ANNOUNCE } from "@/lib/match-fit-product-version";
import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";
import { HomeRoleDefinitionTerm } from "@/components/home-role-definition-term";
import { HomeFollowUsPopover } from "@/components/home-follow-us-popover";
import { useGradientSpotlight } from "@/hooks/use-gradient-spotlight";
import { GradientSpotlight } from "@/components/gradient-spotlight";

const chevronClass =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] text-xs font-bold text-white/45 transition-transform duration-200 group-open:rotate-90";

const summaryRowClass =
  "flex w-full cursor-pointer list-none items-start gap-3 text-left [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70";

export function HomeBetaPromoBanner() {
  const trainerFoundingCap = getTrainerFoundingBgPercentMax();
  const {
    ref: spotlightRef,
    onMouseMove: onSpotlightMouseMove,
    onMouseEnter: onSpotlightMouseEnter,
    onMouseLeave: onSpotlightMouseLeave,
    onClick: onSpotlightClick,
  } = useGradientSpotlight<HTMLDetailsElement>();

  return (
    <details
      id="beta-welcome"
      open
      ref={spotlightRef}
      onMouseMove={onSpotlightMouseMove}
      onMouseEnter={onSpotlightMouseEnter}
      onMouseLeave={onSpotlightMouseLeave}
      onClick={onSpotlightClick}
      className="group relative w-full min-w-0 scroll-mt-28 overflow-hidden rounded-3xl border border-[#FFD34E]/25 bg-[linear-gradient(135deg,rgba(255,211,78,0.14)_0%,rgba(255,126,0,0.1)_45%,rgba(227,43,43,0.12)_100%)] shadow-[0_24px_80px_-32px_rgba(255,126,0,0.4)] backdrop-blur-xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,211,78,0.35),transparent_68%)]"
      />
      <GradientSpotlight color="rgba(255,220,120,0.17)" />
      <summary className={`${summaryRowClass} p-4 sm:p-7`}>
        <span className={chevronClass} aria-hidden>
          ▸
        </span>
        <div className="relative min-w-0 flex-1">
          <h1
            id="beta-welcome-heading"
            className="text-balance text-left text-lg font-black uppercase leading-snug tracking-[0.04em] text-white sm:text-2xl sm:leading-tight sm:tracking-wide md:text-[1.65rem]"
          >
            Active Promotions
          </h1>
          <p className="mt-2 text-left text-xs text-white/45 sm:text-sm">
            Tap to expand or collapse launch details and founding promos.
          </p>
        </div>
      </summary>

      <div className="relative min-w-0 border-t border-[#FFD34E]/15 px-4 pb-4 pt-5 sm:px-7 sm:pb-7">
        <div className="space-y-3 text-pretty text-left text-[14px] leading-relaxed text-white/65 [overflow-wrap:anywhere] sm:text-[15px] md:text-base">
          <p>
            Thank you for joining Match Fit! Match Fit is built to connect anyone looking to accomplish their
            fitness goals with the best fitness professionals that will help anyone get there.
          </p>
        </div>

        <div className="mt-5 min-w-0 space-y-3 rounded-2xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] p-4 sm:p-5">
          <p className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFD34E] [overflow-wrap:anywhere] sm:text-xs sm:tracking-[0.2em]">
            Founding Fitness Pro Beta Promotion
          </p>
          <p className="text-left text-sm leading-relaxed text-white/75 [overflow-wrap:anywhere] sm:text-[15px]">
            First {trainerFoundingCap} Coaches &amp; Listers:{" "}
            <HomeRoleDefinitionTerm role="fitness_pro" label="Fitness Pros" /> &amp;{" "}
            <HomeRoleDefinitionTerm role="elite_pro" label="Elite Pros" /> get premium access for{" "}
            {TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days for <span className="font-bold text-[#FFD34E]">FREE</span>.{" "}
            <HomeRoleDefinitionTerm role="independent_pro" label="Independent Pros" /> &amp;{" "}
            <HomeRoleDefinitionTerm role="elite_pro" label="Elite Pros" /> get listing access for{" "}
            {TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days for <span className="font-bold text-[#FFD34E]">FREE</span>.
            Background checks are <span className="font-bold text-[#FFD34E]">FULLY</span> covered for{" "}
            <HomeRoleDefinitionTerm role="fitness_pro" label="Fitness Pros" /> &amp;{" "}
            <HomeRoleDefinitionTerm role="elite_pro" label="Elite Pros" />. When the free trial ends in order to
            continue premium status and/or listing access, coaches will be asked to set up a subscription (see
            subscription pricing).
          </p>
        </div>

        <div className="mt-5 space-y-3 text-pretty text-left text-[14px] leading-relaxed text-white/65 [overflow-wrap:anywhere] sm:text-[15px] md:text-base">
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

        <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left text-xs leading-relaxed text-white/45 [overflow-wrap:anywhere] sm:text-[13px]">
          <span className="font-semibold uppercase tracking-wide text-[#FF7E00]/90">Beta rollout:</span> Match Fit is{" "}
          <span className="font-semibold text-white/60">available worldwide</span> — anyone, anywhere can create a
          client account during beta. <span className="font-semibold text-white/60">In-person sessions</span> are
          available wherever a coach lists a service area — each coach sets their own location and travel
          radius. Virtual coaching and discovery are available everywhere. Once the caps are hit, you will be able
          to <span className="font-semibold text-white/85">reserve your username on a waitlist</span> until we
          open up the app to more people.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href="/promos"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_16px_40px_-16px_rgba(227,43,43,0.55)] transition hover:brightness-105"
          >
            View Details
          </Link>
          <HomeFollowUsPopover />
        </div>
      </div>
    </details>
  );
}
