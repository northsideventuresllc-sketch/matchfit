"use client";

import { useSyncExternalStore } from "react";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

const chipClass =
  "shrink-0 whitespace-nowrap rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1 text-[0.55rem] font-bold uppercase leading-tight tracking-[0.12em] text-white/65 shadow-[0_0_20px_-8px_rgba(255,126,0,0.35)] sm:text-[0.6rem] sm:text-white/75";

type Props = { labels: readonly string[] };

export function HomeBrandBannerMarquee({ labels }: Props) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const loop = [...labels, ...labels];
  const trackAnim = reduceMotion ? "animate-mf-banner-marquee-slow" : "animate-mf-banner-marquee";

  return (
    <div className="relative w-full py-2.5">
      <p className="sr-only">Highlights: {labels.join(". ")}.</p>

      <div className="mf-banner-marquee-window relative mx-auto w-full max-w-5xl overflow-hidden py-1 sm:max-w-6xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[10%] max-w-[4.5rem] bg-gradient-to-r from-[#0E1016] via-[#0E1016]/40 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[10%] max-w-[4.5rem] bg-gradient-to-l from-[#0E1016] via-[#0E1016]/40 to-transparent"
        />

        <div
          aria-hidden
          className={`mf-banner-marquee-track flex w-max items-center gap-3 sm:gap-4 ${trackAnim} will-change-transform`}
        >
          {loop.map((label, i) => (
            <span key={`${label}-${i}`} className={chipClass}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
