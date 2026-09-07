import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * BPA-B1-SOCIAL-POSTING-0906: which real-world mechanism posts a given platform, decided from the
 * Venture Map's `match-fit` block instead of guessed or hardcoded per call site — the exact drift
 * JB flagged (an agent trusting whichever workflow doc it read last). Per the marketing workflow
 * skill (Decision #1770): Instagram goes through the Mac mini's Android emulator, everything else
 * — Threads, Facebook, TikTok — goes through Mac mini Chrome per `nvg-browser-publishing`.
 */
export type PostingWorkflow = "emulator" | "mini_chrome";

export type MatchFitVentureBlock = {
  id: string;
  channels: Record<string, string>;
};

/** NVG_VAULT_PATH env var first, then the documented default checkout location. */
export function resolveVentureMapPath(): string {
  const base = process.env.NVG_VAULT_PATH?.trim() || path.join(os.homedir(), "nvg/repos/nv-vault");
  return path.join(base, "_Command Center", "venture-map.json");
}

/**
 * Reads the live `match-fit` block out of the vault's venture-map.json. Returns null — never a
 * guess — when the file can't be read, isn't valid JSON, the block is missing, or it has no
 * channels. `readFile` is injectable so tests never touch the real filesystem or a real vault
 * checkout.
 */
export function loadMatchFitVentureBlock(
  readFile: (filePath: string) => string = (filePath) => fs.readFileSync(filePath, "utf8"),
): MatchFitVentureBlock | null {
  let raw: string;
  try {
    raw = readFile(resolveVentureMapPath());
  } catch {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const ventures = (data as { ventures?: unknown })?.ventures;
  if (!Array.isArray(ventures)) return null;

  const block = ventures.find(
    (v): v is MatchFitVentureBlock =>
      typeof v === "object" && v !== null && (v as { id?: unknown }).id === "match-fit",
  );
  if (!block) return null;

  const channels = block.channels;
  if (!channels || typeof channels !== "object" || Object.keys(channels).length === 0) return null;

  return block;
}

/** Instagram is the emulator's job; every other Match Fit channel is Mac mini Chrome. */
export function resolvePlatformWorkflow(platform: string): PostingWorkflow {
  return /instagram/i.test(platform) ? "emulator" : "mini_chrome";
}

/** True when any platform in the set needs the emulator, so the batch needs a live probe. */
export function planRequiresEmulator(platforms: string[]): boolean {
  return platforms.some((p) => resolvePlatformWorkflow(p) === "emulator");
}

export type PostForApproval = { id: string; approved_at: string | null };

/**
 * Approve-only guard: splits a candidate batch into rows that actually carry the existing
 * approval marker (`approved_at`, set by `approveV2Post` — see content-calendar-v2-store.ts) and
 * rows that don't. Nothing downstream of this may post a row from `skipped`.
 */
export function partitionByApproval<T extends PostForApproval>(
  posts: T[],
): { approved: T[]; skipped: { id: string; reason: string }[] } {
  const approved: T[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const post of posts) {
    if (post.approved_at) {
      approved.push(post);
    } else {
      skipped.push({ id: post.id, reason: "not approved — missing approved_at" });
    }
  }
  return { approved, skipped };
}
