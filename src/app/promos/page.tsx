import Image from "next/image";
import Link from "next/link";
import { getLaunchPromoStats } from "@/lib/launch-promo-stats";
import { GradientBubbleCard } from "@/components/gradient-bubble-card";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";
import { clientBetaVipTrialSummary, clientVipPriceLabel } from "@/lib/client-plan-copy";
import { FP_TIER_MONTHLY_FEES_USD } from "@/lib/fp-account-tier-types";
import {
  getClientFoundingTrialMaxClients,
  getTrainerFoundingBgCoveredMax,
} from "@/lib/match-fit-launch-promotion-caps";
import {
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  trainerIndependentProSubscriptionLabel,
} from "@/lib/trainer-signup-promo-copy";

export const dynamic = "force-dynamic";

export const metadata = { title: "Current Promos | Match Fit" };

/**
 * Founding promo details per sign-up type (JB's exact role definitions, 2026-09-14).
 * Collapsible menus on the promos page — see item 3 of the promo-page-overhaul task.
 */
const FOUNDING_ROLE_DETAILS: Array<{
  id: string;
  title: string;
  description: string;
  bullets: string[];
}> = [
  {
    id: "fitness-pro",
    title: "Fitness Pro",
    description:
      "Coaches who decide to use Match Fit as a management software to find, connect, manage, and process clients. Best for coaches who are more of an indie coach who is an entrepreneur.",
    bullets: [
      `Premium access free for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days.`,
      "Background check fully covered.",
      "After the trial, keep premium status with the platform's per-session fee — no flat monthly charge.",
    ],
  },
  {
    id: "independent-pro",
    title: "Independent Pro",
    description:
      "Coaches and fitness businesses who decide to use Match Fit as a listing platform to link clients back to their established website/brand. Best for coaches and businesses that are looking for another channel of online exposure to bring in new clients.",
    bullets: [
      `Listing access free for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days.`,
      `After the trial, keep listing access with the ${trainerIndependentProSubscriptionLabel()} subscription.`,
    ],
  },
  {
    id: "elite-pro",
    title: "Elite Pro",
    description:
      "Coaches and fitness businesses looking to get the best of both worlds in what Fitness Pro status and Independent Pro status offers. Best for coaches and businesses looking to integrate a new management platform into their business while looking to acquire new clients.",
    bullets: [
      `Premium access free for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days.`,
      `Listing access free for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days.`,
      "Background check fully covered.",
      `After the trial, keep both with the $${(FP_TIER_MONTHLY_FEES_USD.elite_fitness_pro ?? 40).toFixed(2)} per month subscription.`,
    ],
  },
];

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#FFD34E,#FF7E00,#E32B2B)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * `available: false` means the live count query kept failing (DB/pooler blip) — showing "0 / Y"
 * in that case would read as "all founding spots reopened", which is exactly the wrong-count
 * report this fixes. Show an honest "temporarily unavailable" state instead of a fake number.
 */
function FoundingSpotsCounter({
  count,
  max,
  available,
  remaining,
  active,
}: {
  count: number;
  max: number;
  available: boolean;
  remaining: number;
  active: boolean;
}) {
  if (!available) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">Founding spots claimed</span>
          <span className="text-xs font-semibold text-white/40">Unavailable</span>
        </div>
        <p className="text-xs text-white/40">Live count is temporarily unavailable — check back shortly.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">Founding spots claimed</span>
        <span className="font-bold text-white/80">
          {count} / {max}
        </span>
      </div>
      <ProgressBar value={count} max={max} />
      {active ? (
        <p className="text-xs text-[#FFD34E]">
          {remaining} founding {remaining === 1 ? "spot" : "spots"} remaining
        </p>
      ) : (
        <p className="text-xs text-white/40">Founding spots are full. Standard pricing now applies.</p>
      )}
    </div>
  );
}

export default async function PromosPage() {
  const stats = await getLaunchPromoStats();

  const {
    trainerCount,
    clientCount,
    trainerCountAvailable,
    clientCountAvailable,
    trainerFoundingMax,
    clientFoundingMax,
    trainerFoundingRemaining,
    clientFoundingRemaining,
    trainerFoundingActive,
    clientFoundingActive,
    clientBetaCap,
    clientBetaSlotsRemaining,
    clientBetaSlotsAvailable,
    trainerWaitlistOpen,
    clientWaitlistOpen,
  } = stats;

  const trainerCapFull = trainerWaitlistOpen;
  const clientCapFull = clientWaitlistOpen;
  const trainerFoundingBgCoveredMax = getTrainerFoundingBgCoveredMax();
  const clientFoundingTrialMaxClients = getClientFoundingTrialMaxClients();

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.10),transparent_50%)]"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="48px" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight">
                <span className="text-[#E8EAEF]">Match</span>{" "}
                <span className="text-[#E32B2B]">Fit</span>
              </p>
              <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/80">
                Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
              </p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-white/50 transition hover:text-white/80"
          >
            &larr; Home
          </Link>
        </header>

        <div className="mt-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">
            Limited-time offers
          </p>
          <h1 className="mt-3 text-balance text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Current{" "}
            <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
              Promos
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/55 sm:text-base">
            As a thank-you to our founding members, we are offering exclusive deals until our first goals are
            reached. Once the caps hit, standard pricing applies.
          </p>
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left text-xs leading-relaxed text-white/50 sm:text-[13px]">
            <span className="font-semibold uppercase text-[#FF7E00]/90">Beta reach:</span>{" "}
            <span className="font-semibold text-white/70">Up to {trainerFoundingBgCoveredMax} Fitness Pros</span> and{" "}
            <span className="font-semibold text-white/70">up to {clientFoundingTrialMaxClients} clients</span> can join during beta —{" "}
            <span className="font-semibold uppercase text-white/70">available worldwide</span>.
          </div>
        </div>

        <div className="mt-10 space-y-6">
          <GradientBubbleCard
            className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(255,126,0,0.35)] backdrop-blur-xl sm:p-9"
            spotlightColor="rgba(255,150,40,0.17)"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.22),transparent_68%)]"
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">
                    For fitness professionals
                  </p>
                  <h2 className="mt-2 text-xl font-black uppercase tracking-wide text-white sm:text-2xl">
                    Founding Coach Promo
                  </h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                    trainerFoundingActive
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {trainerFoundingActive ? "Active" : "Ended"}
                </span>
              </div>

              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-white/65 sm:text-base">
                Founding spots are open to Fitness Pros, Independent Pros, and Elite Pros worldwide. See exactly
                what comes with each sign-up type below.
              </p>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/60">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#FF7E00]/90">Promo details</p>
                <p className="mt-3 text-xs leading-relaxed text-white/55">
                  Background checks are waived completely for the first {trainerFoundingBgCoveredMax} coach
                  sign-ups — no upfront screening cost.
                </p>

                <div className="mt-4 space-y-2">
                  {FOUNDING_ROLE_DETAILS.map((role) => (
                    <details
                      key={role.id}
                      className="group overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02] open:border-[#FF7E00]/30 open:bg-white/[0.04]"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-bold text-white/80 [&::-webkit-details-marker]:hidden">
                        {role.title}
                        <span
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.1] text-[0.65rem] text-white/45 transition-transform duration-200 group-open:rotate-90"
                          aria-hidden
                        >
                          ▸
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-white/[0.06] px-3 pb-3 pt-2.5">
                        <p className="text-xs leading-relaxed text-white/60">{role.description}</p>
                        <ul className="space-y-1.5 text-xs leading-relaxed text-white/55">
                          {role.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7E00]/80" aria-hidden />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <FoundingSpotsCounter
                  count={trainerCount}
                  max={trainerFoundingMax}
                  available={trainerCountAvailable}
                  remaining={trainerFoundingRemaining}
                  active={trainerFoundingActive}
                />
              </div>

              <div className="mt-6 flex justify-center">
                {trainerCapFull ? (
                  <Link
                    href="/waitlist/trainer"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60"
                  >
                    Join Fitness Pro Waitlist
                  </Link>
                ) : (
                  <Link
                    href="/trainer/signup"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition hover:opacity-90"
                  >
                    Sign Up Now
                  </Link>
                )}
              </div>
            </div>
          </GradientBubbleCard>

          <GradientBubbleCard
            className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.35)] backdrop-blur-xl sm:p-9"
            spotlightColor="rgba(240,90,90,0.17)"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -bottom-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.22),transparent_68%)]"
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E32B2B]">
                    For clients
                  </p>
                  <h2 className="mt-2 text-xl font-black uppercase tracking-wide text-white sm:text-2xl">
                    Beta VIP Trial
                  </h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                    clientFoundingActive
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {clientFoundingActive ? "Active" : "Ended"}
                </span>
              </div>

              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-white/65 sm:text-base">
                Complete client sign-up and agree to the Terms of Service to start{" "}
                <span className="font-bold text-[#FFD34E]">{clientBetaVipTrialSummary()}</span> with full VIP access.
                After the trial, your account moves to the Free plan unless you subscribe to VIP for{" "}
                <span className="font-semibold text-white/80">{clientVipPriceLabel()}/month</span>.
              </p>

              <div className="mt-6">
                <FoundingSpotsCounter
                  count={clientCount}
                  max={clientFoundingMax}
                  available={clientCountAvailable}
                  remaining={clientFoundingRemaining}
                  active={clientFoundingActive}
                />
              </div>

              {stats.gatesEnabled ? (
                <p className="mt-4 text-[11px] text-white/40">
                  {clientBetaSlotsAvailable ? (
                    <>
                      Beta membership capacity: {stats.clientBetaSlotsUsed} / {clientBetaCap} slots used
                      {clientBetaSlotsRemaining > 0
                        ? ` (${clientBetaSlotsRemaining} open)`
                        : " (full — waitlist open)"}
                    </>
                  ) : (
                    "Beta membership capacity: temporarily unavailable — check back shortly."
                  )}
                </p>
              ) : null}

              <div className="mt-6 flex justify-center">
                {clientCapFull ? (
                  <Link
                    href="/waitlist/client"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60"
                  >
                    Join Client Waitlist
                  </Link>
                ) : (
                  <Link
                    href="/client/sign-up"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition hover:opacity-90"
                  >
                    Sign Up Now
                  </Link>
                )}
              </div>
            </div>
          </GradientBubbleCard>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center">
          <Link
            href="/"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
          >
            Home
          </Link>
          <Link
            href="/client/sign-up"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
          >
            Client Sign Up
          </Link>
          <Link
            href="/trainer/signup"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
          >
            Fitness Pro Sign Up
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
