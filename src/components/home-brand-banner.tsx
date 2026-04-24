import { HomeBrandBannerMarquee } from "@/components/home-brand-banner-marquee";

const BANNER_BUBBLE_LABELS = [
  "Trainer travels to you",
  "Your location, your call",
  "Flexible for your schedule",
  "Virtual sessions",
  "DIY workout programs",
  "Nutrition coaching",
  "Individualized. Experience.",
  "Experienced trainers",
  "Certified coaches",
  "Goal-focused support",
] as const;

export function HomeBrandBanner() {
  return (
    <div className="relative z-10 mt-5 w-full sm:mt-7">
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        <div className="relative overflow-hidden border-y border-white/[0.06] bg-[#0E1016]/85 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[min(42%,20rem)] bg-[linear-gradient(115deg,rgba(255,211,78,0.22)_0%,rgba(255,126,0,0.12)_45%,transparent_78%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[conic-gradient(from_200deg_at_50%_50%,#FFD34E,#FF7E00,#E32B2B,#FF7E00,#FFD34E)] opacity-20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(227,43,43,0.06)_55%,rgba(255,126,0,0.05)_100%)]"
          />

          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-5 text-center sm:gap-4 sm:px-8 sm:py-6 lg:px-10">
            <p className="max-w-3xl text-pretty text-base font-semibold uppercase italic leading-snug tracking-[0.14em] sm:text-lg md:text-xl lg:text-2xl">
              <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
                Connect. Train smarter. Build momentum that lasts.
              </span>
            </p>
          </div>

          <HomeBrandBannerMarquee labels={BANNER_BUBBLE_LABELS} />

          <div
            aria-hidden
            className="h-[3px] w-full bg-[linear-gradient(90deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] opacity-90"
          />
        </div>
      </div>
    </div>
  );
}
