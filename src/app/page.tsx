import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.18),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.12),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.1),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.35)_0%,transparent_35%,transparent_70%,rgba(11,12,15,0.9)_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl sm:h-16 sm:w-16">
              <Image
                src="/logo.png"
                alt="Match Fit"
                fill
                className="object-contain"
                priority
                sizes="64px"
              />
            </div>
            <div className="leading-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Atlanta
              </p>
              <p className="mt-1 text-sm font-black tracking-tight sm:text-base">
                <span className="text-[#E8EAEF]">Match</span>{" "}
                <span className="text-[#E32B2B]">Fit</span>
              </p>
            </div>
          </div>
          <Link
            href="#cta"
            className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:inline-flex"
          >
            Get started
          </Link>
        </header>

        <section className="mt-14 flex flex-1 flex-col items-center text-center sm:mt-20 lg:mt-24">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-10 rounded-[2.5rem] bg-[conic-gradient(from_200deg_at_50%_50%,#FFD34E,#FF7E00,#E32B2B,#FF7E00,#FFD34E)] opacity-25 blur-3xl"
            />
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#FFD34E]/25 via-[#FF7E00]/15 to-[#E32B2B]/20 blur-xl" />
              <div className="relative h-full w-full overflow-hidden rounded-[2rem] p-3 sm:p-4">
                <Image
                  src="/logo.png"
                  alt="Match Fit logo"
                  width={512}
                  height={512}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          <p className="mt-10 max-w-3xl text-balance font-black tracking-[-0.045em] text-[2.1rem] leading-[1.05] sm:text-5xl sm:leading-[1.02] lg:text-[3.35rem]">
            <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
              The Perfect Match
            </span>{" "}
            <span className="text-[#F4F6FA]">for Your Fitness Journey.</span>
          </p>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
            One roster. Two paths. Match Fit pairs Atlanta&apos;s most sought-after
            trainers with clients who expect white-glove results, not guesswork.
          </p>

          <div
            id="cta"
            className="mt-12 flex w-full max-w-xl flex-col gap-4 sm:mt-14 sm:flex-row sm:justify-center"
          >
            <Link
              href="#for-clients"
              className="group relative isolate flex min-h-[3.75rem] flex-1 items-center justify-center overflow-hidden rounded-2xl px-6 text-base font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_24px_60px_-18px_rgba(227,43,43,0.55)] transition duration-200 active:translate-y-px sm:min-h-[4rem] sm:flex-none sm:min-w-[220px] sm:text-[0.95rem]"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
              />
              <span
                aria-hidden
                className="absolute inset-px rounded-[0.9rem] bg-white/10 opacity-0 transition group-hover:opacity-100"
              />
              <span className="relative">Find a Trainer</span>
            </Link>

            <Link
              href="#for-trainers"
              className="group relative flex min-h-[3.75rem] flex-1 items-center justify-center overflow-hidden rounded-2xl px-6 text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_20px_60px_-22px_rgba(0,0,0,0.9)] transition duration-200 active:translate-y-px sm:min-h-[4rem] sm:flex-none sm:min-w-[220px] sm:text-[0.95rem]"
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-[#12151C]"
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(255,211,78,0.35),rgba(255,126,0,0.2),rgba(227,43,43,0.35))] opacity-70 blur-xl transition group-hover:opacity-100"
              />
              <span className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,#FFD34E,#FF7E00,#E32B2B)] p-[1.5px]">
                <span className="flex h-full w-full items-center justify-center rounded-[0.925rem] bg-[#0E1016]">
                  Join the Roster
                </span>
              </span>
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-5 sm:mt-24 lg:grid-cols-2 lg:gap-6">
          <article
            id="for-trainers"
            className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#12151C]/80 p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.35),transparent_65%)]"
            />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]">
              For trainers
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Atlanta&apos;s top coaches belong here.
            </h2>
            <p className="mt-4 text-pretty text-[15px] leading-relaxed text-white/60 sm:text-base">
              Showcase your specialty, protect your time, and get introduced to
              serious clients-athletes, executives, and performers-who are ready
              to invest in outcomes.
            </p>
          </article>

          <article
            id="for-clients"
            className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#12151C]/80 p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 -bottom-28 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.28),transparent_68%)]"
            />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E32B2B]">
              For clients
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              The best in the city-without the noise.
            </h2>
            <p className="mt-4 text-pretty text-[15px] leading-relaxed text-white/60 sm:text-base">
              Stop scrolling endless profiles. Match Fit is built for people who
              want elite training, structured progression, and recovery that keeps
              you durable-not just tired.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
