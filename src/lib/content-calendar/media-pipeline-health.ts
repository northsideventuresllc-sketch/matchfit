import "server-only";

import { createNiBrainClient } from "@/lib/ni-brain-client";

/**
 * Health of the media/posting pipeline that actually runs on JB's Mac mini. The Pending and
 * Publishing tabs poll this so a build/post that isn't moving shows a plain-English reason instead
 * of a silently stuck loading bar (JB 2026-09-03: "nothing has gone out this week").
 *
 * Two real signals, both content-scoped:
 *  - Mac mini liveness (nvg_mini_heartbeat.last_seen). If it's stale, nothing generates or posts.
 *  - Stuck media jobs the mini has parked for JB (nvg_mini_jobs blocked_needs_jb referencing the
 *    Gemini media script). These are the ones that block content specifically.
 *
 * We deliberately do NOT surface AXON's FIRE/HOLD gate here — that gate governs AXON's own
 * publish path, not Match Fit's mini queue, so showing it would be an unconfirmed blocker.
 */
export type MediaPipelineHealth = {
  status: "ok" | "mini_offline" | "attention";
  /** Plain-English one-liner for the banner. Empty when status is "ok". */
  message: string;
  miniOnline: boolean;
  miniLastSeenIso: string | null;
  miniAgeMinutes: number | null;
  stuckMediaJobs: number;
};

/** Heartbeat older than this = the mini runner is considered offline. It normally beats every minute. */
const MINI_OFFLINE_AFTER_MINUTES = 10;

export async function getMediaPipelineHealth(): Promise<MediaPipelineHealth> {
  const client = createNiBrainClient();

  let miniLastSeenIso: string | null = null;
  try {
    const { data } = await client
      .from("nvg_mini_heartbeat")
      .select("last_seen")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle();
    miniLastSeenIso = (data?.last_seen as string | undefined) ?? null;
  } catch {
    miniLastSeenIso = null;
  }

  const ageMs = miniLastSeenIso ? Date.now() - new Date(miniLastSeenIso).getTime() : null;
  const miniAgeMinutes = ageMs === null || Number.isNaN(ageMs) ? null : Math.round(ageMs / 60_000);
  const miniOnline = miniAgeMinutes !== null && miniAgeMinutes <= MINI_OFFLINE_AFTER_MINUTES;

  let stuckMediaJobs = 0;
  try {
    const { count } = await client
      .from("nvg_mini_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked_needs_jb")
      .ilike("payload->>cmd", "%gemini-media-automation%");
    stuckMediaJobs = count ?? 0;
  } catch {
    stuckMediaJobs = 0;
  }

  if (!miniOnline) {
    return {
      status: "mini_offline",
      message:
        "The Mac mini media agent looks offline, so new media won't generate and posts won't go out until it's back on.",
      miniOnline,
      miniLastSeenIso,
      miniAgeMinutes,
      stuckMediaJobs,
    };
  }

  if (stuckMediaJobs > 0) {
    return {
      status: "attention",
      message: `${stuckMediaJobs} media ${stuckMediaJobs === 1 ? "job is" : "jobs are"} waiting on you before they can run.`,
      miniOnline,
      miniLastSeenIso,
      miniAgeMinutes,
      stuckMediaJobs,
    };
  }

  return { status: "ok", message: "", miniOnline, miniLastSeenIso, miniAgeMinutes, stuckMediaJobs };
}
