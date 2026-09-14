#!/usr/bin/env node
/**
 * Manual/agent runner for the Match Fit outreach lead finder (online / virtual coaches,
 * NATIONWIDE — no city, no polygon, no lat/long, anywhere).
 *
 * Scripts OUT, Agents IN (NI-Brain Decision #1786): this used to be `scripts/outreach-lead-finder.ts`,
 * a bespoke one-off script that could only run via `npx tsx` because it imported the "server-only"
 * Prisma-backed lane logic straight out of the Next.js app (`@/lib/outreach-nationwide-finder`).
 * That made it the one file in `scripts/` that didn't match every other script here — plain,
 * dependency-free ESM run with `node`. It never was the production path either way: the real
 * cron entrypoint is `src/app/api/cron/outreach-lead-finder/route.ts`, fired on a schedule by
 * `nv-vault/.github/workflows/mf-lead-finder-nationwide.yml` (this repo's own
 * `.github/workflows/match-fit-outreach-lead-finder.yml` is the manual-dispatch fallback — see
 * that file for why the schedule lives in nv-vault instead).
 *
 * This module calls that SAME route over HTTP instead of importing the app's server-only code
 * directly — one code path, one set of auth checks (`hasValidCoworkSecret`), callable by hand or
 * wired into ARCEUS as a plain Node module with no framework runtime dependency. All of the
 * lane logic (SerpApi search, filters, drafting, DB writes) still lives in
 * `src/lib/outreach-nationwide-finder.ts`, unchanged by this file — this is just the runner.
 *
 * No LLM call anywhere in this path: the finder does a plain-text template fill and a local
 * dictionary spellcheck pass (`nspell`, no network). If an LLM call is ever added to this flow,
 * it must go through `scripts/lib/axon-llm.mjs`'s provider chain (local Ollama -> RunPod ->
 * OpenRouter Free -> Gemini Flash -> Claude Haiku, paid Anthropic last resort only) per the
 * org's AI Vault default — never a direct provider call.
 *
 * Usage:
 *   MATCH_FIT_APP_URL=https://match-fit.net CRON_SECRET=... node scripts/outreach-lead-finder.mjs
 *   node scripts/outreach-lead-finder.mjs --force   # run even on a weekend / off-hour, for testing
 *
 * Env (same two secrets the GitHub Actions workflow uses):
 *   MATCH_FIT_APP_URL — production base URL, no trailing slash (e.g. https://match-fit.net)
 *   CRON_SECRET        — Vercel env secret also accepted by the route's hasValidCoworkSecret() check
 */

const appUrl = process.env.MATCH_FIT_APP_URL?.trim().replace(/\/+$/, "");
const cronSecret = process.env.CRON_SECRET?.trim();
const force = process.argv.includes("--force");

async function main() {
  if (!appUrl || !cronSecret) {
    console.error(
      "Missing MATCH_FIT_APP_URL and/or CRON_SECRET. Both are required — see the usage comment " +
        "at the top of this file. Never hardcode either value here.",
    );
    process.exitCode = 1;
    return;
  }

  const url = `${appUrl}/api/cron/outreach-lead-finder${force ? "?force=1" : ""}`;
  console.log(`GET ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) {
    console.error(`Lead finder call failed: HTTP ${res.status}`);
    process.exitCode = 1;
    return;
  }
  if (body?.summary?.incomplete) {
    console.warn("Lead finder ran but at least one lane came up short of its target — see summary above.");
  }
}

main().catch((err) => {
  console.error("Outreach lead finder runner failed:", err?.message || err);
  process.exitCode = 1;
});
