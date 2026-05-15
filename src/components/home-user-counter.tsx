import type { HomeUserCounts } from "@/lib/home-user-counts";

function formatCount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

type HomeUserCounterProps = HomeUserCounts;

export function HomeUserCounter({
  trainersTotal,
  trainersActive,
  clientsTotal,
  clientsActive,
}: HomeUserCounterProps) {
  const stats = [
    {
      label: "Trainers signed up",
      value: trainersTotal,
      hint: "All coach accounts on Match Fit (excluding removed profiles).",
    },
    {
      label: "Active trainers",
      value: trainersActive,
      hint: "Completed onboarding and either activated in the last 60 days or recent sessions, messages, FitHub, or check-ins.",
    },
    {
      label: "Clients signed up",
      value: clientsTotal,
      hint: "All member accounts (excluding removed profiles).",
    },
    {
      label: "Active clients",
      value: clientsActive,
      hint: "Subscription in good standing or a platform renewal payment in the last 14 days.",
    },
  ] as const;

  return (
    <section
      aria-labelledby="home-user-counter-heading"
      className="relative z-10 mt-8 w-full sm:mt-10"
    >
      <div className="rounded-3xl border border-white/[0.08] bg-[#0E1016]/90 p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-6">
        <h2 id="home-user-counter-heading" className="sr-only">
          Match Fit community size
        </h2>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          Live community
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-4 text-center sm:px-4 sm:py-5"
              title={item.hint}
            >
              <p className="text-[0.65rem] font-semibold uppercase leading-tight tracking-wide text-white/50 sm:text-xs">
                {item.label}
              </p>
              <p className="mt-2 bg-gradient-to-br from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-2xl font-black tabular-nums tracking-tight text-transparent sm:text-3xl">
                {formatCount(item.value)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[0.65rem] leading-relaxed text-white/35 sm:text-xs">
          Active trainers include new onboardings in the past 60 days or coaches with platform activity in the past
          week. Active clients have billing in good standing or paid a subscription invoice in the past 14 days.
        </p>
      </div>
    </section>
  );
}
