"use client";

import { useEffect, useState } from "react";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";

/**
 * How long a media build is assumed to take, wall-clock, once media_generation_started_at is
 * stamped. There is no real progress signal from the generation job — this is the same kind of
 * educated-guess duration use-simulated-progress.ts's phase weights assume for its own animation
 * (a few seconds of animated "generating" time standing in for the real request), just anchored
 * to a real timestamp here instead of an interval that resets on remount, so a page refresh
 * mid-build still shows the right percentage.
 */
export const PENDING_MEDIA_BUILD_DURATION_MS = 3 * 60 * 1000; // 3 minutes

export type PendingProgressView = {
  /** 0-100, clamped. 100 once media is ready (or there was never anything to build). */
  percent: number;
  /** True while a build is genuinely in flight and the assumed duration hasn't elapsed yet. */
  active: boolean;
  /** Short plain-English line — "About 2 minutes left.", "Any moment now.", "Ready.", etc. */
  etaLabel: string;
};

type PendingProgressPost = Pick<ClientContentCalendarV2Post, "postType" | "mediaStatus" | "mediaGenerationStartedAt">;

function computeView(post: PendingProgressPost, now: number): PendingProgressView {
  if (post.postType === "Text" || post.mediaStatus === "ready") {
    return { percent: 100, active: false, etaLabel: "Ready." };
  }
  if (post.mediaStatus === "failed") {
    return { percent: 0, active: false, etaLabel: "Media build failed." };
  }

  const startedAt = post.mediaGenerationStartedAt ? new Date(post.mediaGenerationStartedAt).getTime() : null;
  if (!startedAt || Number.isNaN(startedAt)) {
    return { percent: 0, active: post.mediaStatus === "generating", etaLabel: "Waiting to start." };
  }

  const elapsed = Math.max(0, now - startedAt);
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / PENDING_MEDIA_BUILD_DURATION_MS) * 100)));
  const remainingMs = PENDING_MEDIA_BUILD_DURATION_MS - elapsed;

  const etaLabel =
    remainingMs <= 0
      ? "Any moment now."
      : Math.ceil(remainingMs / 60_000) <= 1
        ? "About a minute left."
        : `About ${Math.ceil(remainingMs / 60_000)} minutes left.`;

  return { percent, active: percent < 100, etaLabel };
}

/**
 * Elapsed-time-driven media-build progress for one Pending post — correct even right after a page
 * refresh, unlike use-simulated-progress.ts, which animates purely in-memory and resets on remount.
 * Ticks once a second only while a build is actually in flight.
 */
export function usePendingProgress(post: PendingProgressPost): PendingProgressView {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (post.postType === "Text" || post.mediaStatus !== "generating") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [post.postType, post.mediaStatus]);

  return computeView(post, now);
}
