"use client";

import { useState } from "react";
import {
  CONTENT_EXPERIMENT_28_DAY,
  MATCH_FIT_AVATAR_IMAGE_PATH,
  MATCH_FIT_AVATAR_NAME,
} from "@/lib/content-calendar/constants";

export function WeeklyScheduleGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label="Active 28-day content experiment schedule and archetype matrix"
      className="rounded-2xl border border-white/[0.08] bg-[#0E1118] p-4 sm:p-5 shadow-lg shadow-black/20"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#FF7E00]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD34E]">
              28-Day Content Experiment (9.28 – 10.25)
            </span>
            <span className="text-[11px] font-semibold text-white/50">
              10 Posts / Week · Dynamic Randomized Assignment
            </span>
          </div>
          <h2 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white">
            3-Archetype Content Mix &amp; Avatar Matrix
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/[0.08] hover:text-white sm:self-center transition-colors"
        >
          {expanded ? "Hide Test Details ▲" : "View Test Details ▼"}
        </button>
      </div>

      {/* 4 Archetype Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Generic Info */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#141822]/90 p-3.5 hover:border-[#FF7E00]/40 transition-all">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-black uppercase tracking-wider text-[#FFD34E]">Generic Info</span>
              <span className="rounded-full bg-[#FF7E00]/15 px-2 py-0.5 text-[9px] font-bold text-[#FFD34E]">3 / WEEK</span>
            </div>
            <p className="mt-2 text-xs font-bold text-white/90">Product &amp; Promo Features</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              Direct value propositions: trainer matching, Fit Hub feed, directory listings, and founding coach fee waivers (first 30 free for 60 days).
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-white/40">
            Formats: <strong className="text-white/80">Carousel, Static, Video</strong>
          </div>
        </div>

        {/* Card 2: UGC Talking Head Avatar */}
        <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-[#141822]/90 p-3.5 hover:border-emerald-400/40 transition-all">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">UGC Avatar</span>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">4 / WEEK</span>
            </div>
            <p className="mt-2 text-xs font-bold text-white/90">Talking Head ({MATCH_FIT_AVATAR_NAME})</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              Authentic creator talking-head format with our official AI fitness creator avatar. Always attaches avatar reference image for visual consistency.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-white/40">
            Formats: <strong className="text-white/80">Video, Carousel</strong>
          </div>
        </div>

        {/* Card 3: Cinematic Trailer */}
        <div className="flex flex-col justify-between rounded-xl border border-sky-500/20 bg-[#141822]/90 p-3.5 hover:border-sky-400/40 transition-all">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-black uppercase tracking-wider text-sky-300">Cinematic Trailer</span>
              <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[9px] font-bold text-sky-300">1 / WEEK</span>
            </div>
            <p className="mt-2 text-xs font-bold text-white/90">Creative Brand Storytelling</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              High-production, cinematic video pushing Match Fit creatively. Dynamic camera movement, energetic training atmosphere, premium sound design.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-white/40">
            Formats: <strong className="text-sky-300">Strictly Video (Reels/TikTok)</strong>
          </div>
        </div>

        {/* Card 4: Text Posts */}
        <div className="flex flex-col justify-between rounded-xl border border-purple-500/20 bg-[#141822]/90 p-3.5 hover:border-purple-400/40 transition-all">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-black uppercase tracking-wider text-purple-300">Text Posts</span>
              <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[9px] font-bold text-purple-300">2 / WEEK</span>
            </div>
            <p className="mt-2 text-xs font-bold text-white/90">High-Engagement Thought Leadership</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              Clean plain text without markdown bolding (`**`). Eye-catching emojis, thought-provoking coaching takes, and conversation starters on Threads &amp; Facebook.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-white/40">
            Formats: <strong className="text-white/80">Text (Threads, Facebook, X)</strong>
          </div>
        </div>
      </div>

      {/* Expanded Rule Details */}
      {expanded ? (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-3 text-xs leading-relaxed text-white/70">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            28-Day Experiment Rules &amp; Guardrails (9.28.26 – 10.25.26)
          </h3>
          <ul className="list-disc pl-4 space-y-1.5 text-white/60">
            <li>
              <strong className="text-white/90">28-Day Testing Period:</strong> Runs from <strong className="text-[#FFD34E]">{CONTENT_EXPERIMENT_28_DAY.startDate}</strong> through <strong className="text-[#FFD34E]">{CONTENT_EXPERIMENT_28_DAY.endDate}</strong>.
            </li>
            <li>
              <strong className="text-white/90">Weekly Composition:</strong> Exactly 10 posts per week (8 media posts, 2 text posts). The 8 media posts are split into 3 Generic Informational, 4 UGC Avatar, and 1 Cinematic Trailer.
            </li>
            <li>
              <strong className="text-white/90">Randomized Assignment:</strong> Rather than a rigid day-of-week format lock, post archetypes and types are randomized throughout the test to prevent audience fatigue.
            </li>
            <li>
              <strong className="text-white/90">Official Avatar Identity:</strong> UGC content features official avatar <strong className="text-emerald-300">{MATCH_FIT_AVATAR_NAME}</strong> with the permanent reference image (<code className="text-[#FFD34E]">{MATCH_FIT_AVATAR_IMAGE_PATH}</code>) attached to every generation.
            </li>
            <li>
              <strong className="text-white/90">Cinematic Trailer Format:</strong> Cinematic trailer posts are strictly formatted as <strong className="text-sky-300">Video</strong>.
            </li>
            <li>
              <strong className="text-white/90">Zero Markdown Bolding:</strong> Never output asterisks (<code className="text-[#FFB4B4]">**</code>) in captions or text posts. Only plain English is permitted.
            </li>
            <li>
              <strong className="text-white/90">Mandatory Emojis:</strong> AXON agents must include 2–4 eye-catching emojis naturally in every caption and text post.
            </li>
            <li>
              <strong className="text-white/90">Analytics &amp; DPMO Feedback:</strong> Engagement and conversion metrics from the test feed directly into live social performance analytics and DPMO growth phase evaluations.
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
