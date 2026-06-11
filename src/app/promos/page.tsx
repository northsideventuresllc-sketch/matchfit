import Image from "next/image";
import Link from "next/link";
import { getLaunchPromoStats } from "@/lib/launch-promo-stats";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";
import { getClientFoundingTrialDays } from "@/lib/match-fit-launch-promotions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Current Promos | Match Fit" };

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

export default async function PromosPage() {
  const stats = await getLaunchPromoStats();
  const trialDays = getClientFoundingTrialDays();

  const {
    trainerCount,
    clientCount,
    trainerFoundingMax,
    clientFoundingMax,
    trainerFoundingRemaining,
    clientFoundingRemaining,
    trainerFoundingActive,
    clientFoundingActive,
    clientBetaCap,
    clientBetaSlotsRemaining,
    trainerBetaCapAtlanta,
    trainerBetaCapVirtual,
    trainerBetaSlotsUsedAtlanta,
    trainerBetaSlotsUsedVirtual,
    trainerBetaSlotsRemainingAtlanta,
    trainerBetaSlotsRemainingVirtual,
    trainerWaitlistOpen,
    clientWaitlistOpen,
  } = stats;

  const trainerCapFull = trainerWaitlistOpen;
  const clientCapFull = clientWaitlistOpen;

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
            <span className="font-semibold text-[#FF7E00]/90">Beta reach:</span>{" "}
            <span className="font-semibold text-white/70">Up to 30 fitness professionals</span> can join during beta —
            {" "}<span className="font-semibold text-white/70">10 offering in-person sessions</span> in the Atlanta metro area
            (within approximately 15&ndash;20 miles of downtown Atlanta) and{" "}
            <span className="font-semibold text-white/70">20 offering virtual coaching</span> to clients anywhere in the
            United States.{" "}
            <span className="font-semibold text-white/70">Up to 150 clients</span> can join during beta &mdash;
            Atlanta-area clients may book in-person or virtual sessions; clients outside Atlanta are matched with
            virtual coaches only.
          </div>
        </div>

        <div className="mt-10 space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(255,126,0,0.35)] backdrop-blur-xl sm:p-9">
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
                    Founding Coach Pricing
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
                The first{" "}
                <span className="font-bold text-[#FFD34E]">{trainerFoundingMax} fitness professionals</span>{" "}
                to join Match Fit pay only{" "}
                <span className="font-bold text-[#FFD34E]">20% of their background check cost</span> for
                onboarding (instead of the usual $100.00 platform fee minus the screening amount).{" "}
                <span className="font-semibold text-white/70">10 of those spots are reserved for in-person coaches</span>{" "}
                in the Atlanta metro area; the remaining{" "}
                <span className="font-semibold text-white/70">20 spots are open to virtual coaches nationwide</span>.
              </p>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">Founding spots claimed</span>
                  <span className="font-bold text-white/80">
                    {trainerCount} / {trainerFoundingMax}
                  </span>
                </div>
                <ProgressBar value={trainerCount} max={trainerFoundingMax} />
                {trainerFoundingActive ? (
                  <p className="text-xs text-[#FFD34E]">
                    {trainerFoundingRemaining} founding{" "}
                    {trainerFoundingRemaining === 1 ? "spot" : "spots"} remaining
                  </p>
                ) : (
                  <p className="text-xs text-white/40">Founding spots are full. Standard pricing now applies.</p>
                )}
              </div>

              {stats.gatesEnabled ? (
                <div className="mt-4 space-y-1 text-[11px] text-white/40">
                  <p>
                    Atlanta in-person beta pool: {trainerBetaSlotsUsedAtlanta} / {trainerBetaCapAtlanta} slots used
                    {trainerBetaSlotsRemainingAtlanta > 0
                      ? ` (${trainerBetaSlotsRemainingAtlanta} open)`
                      : " (full)"}
                  </p>
                  <p>
                    Nationwide virtual/DIY beta pool: {trainerBetaSlotsUsedVirtual} / {trainerBetaCapVirtual} slots used
                    {trainerBetaSlotsRemainingVirtual > 0
                      ? ` (${trainerBetaSlotsRemainingVirtual} open)`
                      : " (full)"}
                  </p>
                </div>
              ) : null}

              <div className="mt-6">
                {trainerCapFull ? (
                  <Link
                    href="/waitlist/trainer"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60"
                  >
                    Join Trainer Waitlist
                  </Link>
                ) : (
                  <Link
                    href="/trainer/signup"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition hover:opacity-90"
                  >
                    Sign Up as a Trainer
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.35)] backdrop-blur-xl sm:p-9">
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
                    Founding Member Free Trial
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
                Complete client sign-up and agree to the Terms of Service to start a{" "}
                <span className="font-bold text-[#FFD34E]">{trialDays}-day free trial</span> with{" "}
                <span className="font-semibold text-white/80">no card required at sign-up</span>.
              </p>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white/75">Free trial at sign-up</span>
                  <span className="text-white/55">{trialDays} days, no card</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">Founding spots claimed</span>
                  <span className="font-bold text-white/80">
                    {clientCount} / {clientFoundingMax}
                  </span>
                </div>
                <ProgressBar value={clientCount} max={clientFoundingMax} />
                {clientFoundingActive ? (
                  <p className="text-xs text-[#FFD34E]">
                    {clientFoundingRemaining} founding{" "}
                    {clientFoundingRemaining === 1 ? "spot" : "spots"} remaining
                  </p>
                ) : (
                  <p className="text-xs text-white/40">Founding spots are full. Standard pricing now applies.</p>
                )}
              </div>

              {stats.gatesEnabled ? (
                <p className="mt-4 text-[11px] text-white/40">
                  Beta membership capacity: {stats.clientBetaSlotsUsed} / {clientBetaCap} slots used
                  {clientBetaSlotsRemaining > 0
                    ? ` (${clientBetaSlotsRemaining} open)`
                    : " (full — waitlist open)"}
                </p>
              ) : null}

              <div className="mt-6">
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
                    Sign Up as a Client
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm leading-relaxed text-white/45">
          <p className="font-semibold text-white/60">After the founding caps are reached:</p>
          <ul className="mt-3 space-y-1.5">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" aria-hidden />
              <span>Trainers pay the standard onboarding fee ($100.00 minus their background check amount).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" aria-hidden />
              <span>Clients receive a {trialDays}-day free trial at sign-up (no card required).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" aria-hidden />
              <span>
                Waitlist users are notified when slots reopen — standard pricing applies at the time of
                their invite, regardless of when they joined the waitlist.
              </span>
            </li>
          </ul>
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
            Trainer Sign Up
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
