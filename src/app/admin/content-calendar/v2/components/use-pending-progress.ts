"use client";

import { useEffect, useState } from "react";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";

/**
 * Fallback build duration, wall-clock, used ONLY when the producer hasn't written a real
 * `mediaProgress` value yet (older rows, or the Mac mini script running a build that predates the
 * live-progress columns). Once the mini writes real `media_progress` per step, that wins over this
 * estimate. Anchored to a real timestamp so a refresh mid-build still shows the right percentage.
 */
export const PENDING_MEDIA_BUILD_DURATION_MS = 3 * 60 * 1000; // 3 minutes

export type PendingProgressView = {
  /** 0-100, clamped. 100 once media is ready (or there was never anything to build). */
  percent: number;
  /** True while a build is genuinely in flight and not yet complete. */
  active: boolean;
  /** Short plain-English line — the live stage, an ETA, "Ready.", etc. */
  etaLabel: string;
};

type PendingProgressPost = Pick<
  ClientContentCalendarV2Post,
  "postType" | "mediaStatus" | "mediaGenerationStartedAt" | "mediaProgress" | "mediaProgressStage"
>;

/** Plain-English label for the live producer stage (no internal codes on screen — standing rule 4). */
const STAGE_LABELS: Record<string, string> = {
  connecting: "Connecting to Gemini…",
  model_pro: "Setting the model to Gemini Pro…",
  generating: "Generating the media in Gemini Pro…",
  cropping: "Cleaning up the image…",
  uploading: "Saving the finished media…",
  done: "Ready.",
  failed: "Media build failed.",
};

function stageLabel(stage: string | null): string | null {
  if (!stage) return null;
  return STAGE_LABELS[stage] ?? null;
}

function computeView(post: PendingProgressPost, now: number): PendingProgressView {
  if (post.postType === "Text" || post.mediaStatus === "ready") {
    return { percent: 100, active: false, etaLabel: "Ready." };
  }
  if (post.mediaStatus === "failed") {
    return { percent: 0, active: false, etaLabel: stageLabel(post.mediaProgressStage) ?? "Media build failed." };
  }

  // Prefer the REAL progress the Mac mini producer writes step-by-step.
  if (typeof post.mediaProgress === "number") {
    const percent = Math.max(0, Math.min(100, Math.round(post.mediaProgress)));
    const label = stageLabel(post.mediaProgressStage) ?? (percent >= 100 ? "Almost done…" : "Working…");
    return { percent, active: percent < 100, etaLabel: label };
  }

  // Fallback: elapsed-time estimate (producer hasn't reported real progress yet).
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
 * Media-build progress for one Pending post. Uses the producer's real `media_progress` when present
 * (the UI polls the posts list, so a new value arrives on each refetch), and falls back to an
 * elapsed-time estimate otherwise. Ticks once a second only while a build is actually in flight.
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
