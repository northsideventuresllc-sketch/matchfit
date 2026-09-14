"use client";

import { useState } from "react";
import {
  CONTENT_CALENDAR_WEEKDAY_SCHEDULE,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { postTypeIcon } from "./helpers";

export function WeeklyScheduleGuide() {
  const [expanded, setExpanded] = useState(false);
  const scheduleDays = Object.values(CONTENT_CALENDAR_WEEKDAY_SCHEDULE);

  return (
    <section
      aria-label="Active weekly posting schedule and theme rules"
      className="rounded-2xl border border-white/[0.08] bg-[#0E1118] p-4 sm:p-5 shadow-lg shadow-black/20"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#FF7E00]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD34E]">
              Active Weekly Schedule
            </span>
            <span className="text-[11px] font-semibold text-white/50">
              Live Social Posting: Mon · Wed · Fri (8:00 AM ET Weekly Gen)
            </span>
          </div>
          <h2 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white">
            Weekly Post Format &amp; Theme Matrix
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/[0.08] hover:text-white sm:self-center transition-colors"
        >
          {expanded ? "Hide Rule Details ▲" : "View Schedule Rules ▼"}
        </button>
      </div>

      {/* 5-Day Visual Schedule Grid */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {scheduleDays.map((rule) => {
          const isMon = rule.dayIndex === 0;
          const isWed = rule.dayIndex === 2;
          const isFri = rule.dayIndex === 4;

          // Theme badge styling
          const themeAccentClass = isMon
            ? "border-[#FF7E00]/30 bg-[#FF7E00]/10 text-[#FFD34E]"
            : isWed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : isFri
                ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                : "border-white/10 bg-white/[0.03] text-white/80";

          return (
            <div
              key={rule.dayIndex}
              className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
                rule.isLivePostingDay
                  ? "border-white/[0.14] bg-[#141822]/90 hover:border-[#FF7E00]/40"
                  : "border-white/[0.06] bg-[#10131B]/60 hover:border-white/15"
              }`}
            >
              <div>
                {/* Day Header & Live Posting Status */}
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {rule.dayLong}
                  </span>
                  {rule.isLivePostingDay ? (
                    <span
                      title="Live social posting day (TikTok, IG, Threads, FB)"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-tight text-emerald-300"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE POST
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-white/35">DRAFT / VALUE</span>
                  )}
                </div>

                {/* Formats */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {rule.postTypes.map((pt: ContentCalendarPostType) => (
                    <span
                      key={pt}
                      className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/90"
                    >
                      <span className="text-[#FF7E00]">{postTypeIcon(pt)}</span>
                      {pt}
                    </span>
                  ))}
                </div>

                {/* Theme Title */}
                <div className="mt-2.5">
                  <div className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${themeAccentClass}`}>
                    {rule.theme}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-white/55">
                    {rule.audienceDescription}
                  </p>
                </div>
              </div>

              {/* Target Audience & Canonical CTA */}
              <div className="mt-3 pt-2 border-t border-white/[0.04]">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-white/40">Audience:</span>
                  <span className="font-bold text-white/75">{rule.targetGroup}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-white/40">CTA:</span>
                  <span className="font-mono text-[9px] text-[#FFD34E]/90 truncate max-w-[120px]" title={rule.suggestedCta}>
                    /{rule.suggestedCta.split("/").slice(1).join("/")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Rule Details */}
      {expanded ? (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-3 text-xs leading-relaxed text-white/70">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            Active Schedule &amp; Copywriting Guardrails
          </h3>
          <ul className="list-disc pl-4 space-y-1.5 text-white/60">
            <li>
              <strong className="text-white/90">Weekly Generation Rhythm:</strong> Full week (10 posts: 5 days × 2 locked formats) generates every <strong className="text-[#FFD34E]">Monday at 8:00 AM ET</strong> (12:00 UTC).
            </li>
            <li>
              <strong className="text-white/90">Posting Day Cadence:</strong> Monday, Wednesday, and Friday are live social posting days. Posts scheduled same-day after 5:00 PM ET automatically roll to the next posting day.
            </li>
            <li>
              <strong className="text-white/90">Format Lock:</strong> Mon/Wed/Fri strictly receive <strong className="text-white/90">Video + Carousel</strong>. Tue/Thu strictly receive <strong className="text-white/90">Static + Text</strong>.
            </li>
            <li>
              <strong className="text-white/90">Theme Assignment:</strong> Monday = <span className="text-[#FFD34E]">Join Our Team</span> (Trainer recruitment/onboarding) · Wednesday = <span className="text-emerald-300">Client Spotlight</span> (Athlete demand &amp; VIP trial) · Friday = <span className="text-sky-300">List With Us</span> (Independent facility/Pro directory).
            </li>
            <li>
              <strong className="text-white/90">Threads Repurpose Budget:</strong> Max <strong className="text-white/90">500 characters</strong> across caption + hashtags combined.
            </li>
            <li>
              <strong className="text-white/90">High-Volume Hashtags:</strong> Max 5 tags per post, enforced through the locked hashtag rotation.
            </li>
            <li>
              <strong className="text-white/90">Canonical URLs:</strong> Fitness Pros join at <code className="text-[#FFD34E]">match-fit.net/trainer/sign-up</code>; clients join at <code className="text-[#FFD34E]">match-fit.net/client/sign-up</code>.
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
