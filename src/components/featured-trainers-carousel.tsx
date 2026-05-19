"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FeaturedTrainersZipForm } from "@/components/featured-trainers-zip-form";
import type { FeaturedTrainerCard } from "@/lib/featured-homepage-data";

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

const INTERVAL_MS = 4800;

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-5 w-5 sm:h-6 sm:w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? (
        <path d="M15 18 9 12l6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function FeaturedTrainersCarousel({
  trainers = [],
  zipInput,
}: {
  trainers?: FeaturedTrainerCard[];
  /** ZIP used for this load (from profile or `?zip=`). */
  zipInput?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const list = trainers ?? [];
  const n = list.length;

  useEffect(() => {
    const t = window.setTimeout(() => setIndex(0), 0);
    return () => window.clearTimeout(t);
  }, [list]);

  useEffect(() => {
    if (reduceMotion || n <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, n]);

  const active = n > 0 ? list[index]! : null;
  const key = active?.username ?? "empty";

  const profileSrc =
    active?.profileImageUrl?.trim() ? active.profileImageUrl.split("?")[0] ?? null : null;

  const dots = useMemo(() => list.map((t) => t.username), [list]);

  const zipPrefix = zipInput?.trim().replace(/\D/g, "").slice(0, 3);

  return (
    <section
      id="featured-trainers"
      className="mt-16 sm:mt-20"
      aria-labelledby="featured-trainers-heading"
    >
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Near you</p>
        <h2
          id="featured-trainers-heading"
          className="mt-2 text-balance text-xl font-black uppercase tracking-wide text-white sm:text-2xl"
        >
          Featured trainers in your area
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55 sm:text-base">
          {n > 0 ? (
            <>
              Coaches in your ZIP area (first three digits{zipPrefix ? `: ${zipPrefix}` : ""}).{" "}
              <span className="text-white/70">Sponsored</span> and <span className="text-white/70">raffle</span> spots
              refresh daily using an America/New_York cutoff.{" "}
              <Link
                href="/terms#featured-placement"
                className="font-semibold text-[#FF7E00] underline-offset-4 hover:underline"
              >
                How placement works
              </Link>
              .
            </>
          ) : zipInput?.trim() ? (
            <>
              No premium featured coaches are allocated for your ZIP region today. Check back tomorrow, browse the full
              directory after you subscribe, or try a nearby ZIP.
            </>
          ) : (
            <>
              Enter your ZIP to see coaches who paid for sponsored placement or won a daily raffle feature in your
              regional pool—only real Match Fit trainers appear here.
            </>
          )}
        </p>
      </div>

      {n === 0 ? (
        <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-white/[0.08] bg-[#12151C]/90 px-6 py-8 text-center shadow-[0_34px_90px_-48px_rgba(227,43,43,0.55)] backdrop-blur-xl sm:px-8">
          <FeaturedTrainersZipForm initialZip={zipInput} />
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-lg">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/90 px-3 pb-8 pt-8 shadow-[0_34px_90px_-48px_rgba(227,43,43,0.55)] backdrop-blur-xl sm:px-4 sm:pb-10 sm:pt-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,211,78,0.22),transparent_68%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.2),transparent_70%)]"
            />

            <button
              type="button"
              aria-label="Previous trainer"
              className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#0B0C0F]/75 text-white/85 shadow-lg backdrop-blur-sm transition hover:border-white/25 hover:bg-[#0B0C0F]/90 hover:text-white sm:left-2 sm:h-11 sm:w-11"
              onClick={() => setIndex((i) => (i - 1 + n) % n)}
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next trainer"
              className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#0B0C0F]/75 text-white/85 shadow-lg backdrop-blur-sm transition hover:border-white/25 hover:bg-[#0B0C0F]/90 hover:text-white sm:right-2 sm:h-11 sm:w-11"
              onClick={() => setIndex((i) => (i + 1) % n)}
            >
              <ChevronIcon direction="right" />
            </button>

            <div
              key={key}
              className={`relative flex flex-col items-center px-8 text-center sm:px-10 ${
                reduceMotion ? "" : "animate-mf-trainer-fade"
              }`}
            >
              <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-[2rem] bg-[#2d3440] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] ring-2 ring-white/10 sm:h-40 sm:w-40">
                {profileSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="select-none text-4xl font-black tracking-tight text-white/90 sm:text-[2.65rem]">
                    {initialsFromName(active!.displayName)}
                  </span>
                )}
              </div>
              {active!.source === "PAID_BID" ? (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFD34E]/90">Sponsored</p>
              ) : (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Raffle feature</p>
              )}
              <p className="mt-4 text-lg font-bold text-white sm:text-xl">{active!.displayName}</p>
              <p className="mt-2 inline-flex max-w-[20rem] items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#FFD34E]/95 sm:text-[0.7rem]">
                {active!.specialtyLine}
              </p>
              <Link
                href={`/trainers/${encodeURIComponent(active!.username)}`}
                className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-[#FF7E00] underline-offset-4 hover:underline"
              >
                View profile
              </Link>
            </div>

            <div className="relative mt-10 flex justify-center gap-2">
              {dots.map((dotKey, i) => {
                const isOn = i === index;
                return (
                  <button
                    key={dotKey}
                    type="button"
                    aria-label={`Show ${list[i]!.displayName}`}
                    aria-current={isOn ? "true" : undefined}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      isOn
                        ? "w-8 bg-[linear-gradient(90deg,#FFD34E,#FF7E00,#E32B2B)]"
                        : "w-2.5 bg-white/20 hover:bg-white/35"
                    }`}
                    onClick={() => setIndex(i)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
