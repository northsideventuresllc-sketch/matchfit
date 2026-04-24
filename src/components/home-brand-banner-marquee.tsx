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
  "shrink-0 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[0.55rem] font-bold uppercase leading-tight tracking-[0.12em] text-white/50 sm:text-[0.6rem]";

type Props = { labels: readonly string[] };

export function HomeBrandBannerMarquee({ labels }: Props) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  if (reduceMotion) {
    return (
      <div className="flex flex-wrap justify-center gap-1.5 py-2" role="list" aria-label="Match Fit highlights">
        {labels.map((label) => (
          <span key={label} role="listitem" className={chipClass}>
            {label}
          </span>
        ))}
      </div>
    );
  }

  const loop = [...labels, ...labels];

  return (
    <div
      className="relative w-full overflow-hidden py-2"
      role="presentation"
      aria-label="Match Fit highlights, scrolling"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#0E1016] to-transparent sm:w-16"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#0E1016] to-transparent sm:w-16"
      />
      <div className="mf-banner-marquee-track flex w-max animate-mf-banner-marquee gap-2 will-change-transform">
        {loop.map((label, i) => (
          <span key={`${label}-${i}`} className={chipClass}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
