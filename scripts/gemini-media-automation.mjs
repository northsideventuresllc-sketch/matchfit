#!/usr/bin/env node
/**
 * GEMINI MEDIA AUTOMATION — headless, CDP-driven (JB direct order, 2026-08-13;
 * Pro-model + Content Calendar v2 write-back fixes, 2026-09-02)
 * -----------------------------------------------------------------------------
 * Replaces the desktop-bridge-only "generate in Gemini, download, crop, upload"
 * step of WF1 (Match Fit marketing, steps 3-9) with something callable from a
 * scheduled/cloud session that has NO desktop bridge. This is the ONLY path that
 * actually produces media — the Gemini Developer API key behind the REST cron
 * (content-calendar/media-generation.ts) has zero free-tier image/video quota
 * (confirmed live 2026-08-04 and again 2026-09-02), so that path can never
 * succeed regardless of model name or retry count.
 *
 * Runs ON THE MAC MINI, queued via nvg_mini_jobs (kind="shell") — either fired
 * automatically by Content Calendar v2's "FIRE COWORK" / "SUBMIT FOR GENERATION" /
 * "Send To Agent" buttons (queueMiniChromeAgentJob in cowork-jobs.ts), or run by
 * hand: `node gemini-media-automation.mjs <args>`.
 * Never runs in a cloud session — it needs the mini's local Chrome + CDP port.
 *
 * What it does, per pending content_calendar_posts row:
 *   1. Attach to the dedicated automation Chrome profile over CDP (does not
 *      touch JB's live logged-in Chrome — separate --user-data-dir + port).
 *   2. Confirm the Gemini web app's mode picker reads Pro; switch it if not —
 *      JB's standing order is Pro only, Flash never (see ensureProModel below).
 *   3. Open Gemini, paste last_generation_prompt (falls back to visual_prompt),
 *      generate, wait for the image(s).
 *   4. Copy each generated image via Gemini's own "Copy image" control and read
 *      it back off the OS clipboard — the Download button opens a native
 *      File-System-Access save dialog that Playwright/CDP cannot see or drive,
 *      so copy-to-clipboard is the only route that stays inside the page.
 *   5. Crop the white frame Gemini stamps on every output (sharp .trim()).
 *   6. Upload the cropped asset to Supabase Storage bucket
 *      content-calendar-media (NI-Brain project kxijunwgbrlfzvgkhklo).
 *   7. Write media_urls/media_status='ready' AND advance workflow_stage/status
 *      to "publishing" — matching completeGenerateMediaJob's write-back exactly,
 *      so a post generated here continues through Content Calendar v2 the same
 *      way the (broken) API cron path would have. Guarded on workflow_stage
 *      still being "pending", so a post JB already moved elsewhere is untouched.
 *   7.5. Mark the matching match_fit_content_cowork_jobs row(s) complete (or
 *      failed) — added 2026-09-03 (Decision #1722 item 4, lane D2). Before this
 *      the job queue never learned this script had already handled a post, so
 *      the REST cron kept treating it as unresolved and re-queued/clobbered it.
 *   8. Pings JB on Telegram when a batch finishes.
 *
 * Env required (read from /usr/local/etc/nvg-mini.env on the mini, or process env):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY      -- NI-Brain project (kxijunwgbrlfzvgkhklo)
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS   -- comma-separated chat ids
 *   GEMINI_CDP_PORT                          -- default 9333
 *
 * Usage:
 *   node gemini-media-automation.mjs --ids=<uuid>,<uuid>,<uuid>
 *   node gemini-media-automation.mjs --payload=/tmp/job.json   ({"ids":[...]})
 *   node gemini-media-automation.mjs --post-date=2026-08-13 --post-group=5pm
 *   node gemini-media-automation.mjs --check    (diagnostic only, no generation)
 */

import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadMiniEnv() {
  const cfgPath = "/usr/local/etc/nvg-mini.env";
  const out = {};
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const idx = t.indexOf("=");
      out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
    }
  } catch {
    // fine — fall back to process.env
  }
  return out;
}

const MINI_ENV = loadMiniEnv();
function envOf(key) {
  return process.env[key] ?? MINI_ENV[key];
}

const SUPABASE_URL = (envOf("SUPABASE_URL") || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = envOf("SUPABASE_SERVICE_KEY");
const TELEGRAM_BOT_TOKEN = envOf("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_IDS = (envOf("TELEGRAM_CHAT_IDS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CDP_PORT = Number(envOf("GEMINI_CDP_PORT") || 9333);
const BUCKET = "content-calendar-media";
const TABLE = "match_fit_content_calendar_posts";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "FATAL: SUPABASE_URL / SUPABASE_SERVICE_KEY not set (checked env + /usr/local/etc/nvg-mini.env)."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (no SDK dependency — matches nvg-mini-runner.py style)
// ---------------------------------------------------------------------------

async function sbFetch(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function fetchRows({ ids, postDate, postGroup }) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,post_date,post_group,post_type,target_group,visual_prompt,last_generation_prompt,caption,media_status,media_urls,status,workflow_stage"
  );
  if (ids && ids.length) {
    params.set("id", `in.(${ids.join(",")})`);
    // Trust the caller when explicit ids are given (e.g. Content Calendar v2's
    // fireCoworkForPost/fireCoworkForDay, which stage posts at
    // status="pending"/workflow_stage="pending" while media generates — NOT
    // "approved", which is v1's older gate). Filtering `pending` below covers this.
  } else {
    if (postDate) params.set("post_date", `eq.${postDate}`);
    if (postGroup) params.set("post_group", `eq.${postGroup}`);
    params.set("status", "eq.approved");
  }
  const res = await sbFetch(`/rest/v1/${TABLE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`fetch rows failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Matches completeGenerateMediaJob's write-back exactly (content-calendar-cowork-
 * orchestration.ts) so a post generated via this Chrome/Gemini-Pro path continues
 * through Content Calendar v2 the same way the (broken, API-only) cron path would
 * have: media attached AND advanced to workflow_stage/status "publishing". Guarded
 * on workflow_stage still being "pending" for the same reason that function is —
 * a post JB already moved elsewhere (Stop, manual bypass) is left alone.
 */
async function writeMediaResult(rowId, mediaUrls) {
  const res = await sbFetch(`/rest/v1/${TABLE}?id=eq.${rowId}&workflow_stage=eq.pending`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      media_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
      media_status: mediaUrls.length ? "ready" : "failed",
      workflow_stage: "publishing",
      status: "publishing",
      generation_source: "chrome_agent_gemini_pro",
      media_progress: 100,
      media_progress_stage: mediaUrls.length ? "done" : "failed",
      media_progress_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  if (!res.ok) {
    throw new Error(`write-back failed for ${rowId}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Live progress write (added 2026-09-03): the admin Pending tab polls the posts list and drives a
 * real loading bar off media_progress / media_progress_stage instead of guessing from elapsed time.
 * Best-effort and guarded on workflow_stage=pending so it never clobbers a post JB moved elsewhere,
 * and never throws — a progress-write hiccup must not stall a real generation.
 */
async function writeProgress(rowId, percent, stage) {
  try {
    await sbFetch(`/rest/v1/${TABLE}?id=eq.${rowId}&workflow_stage=eq.pending`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: {
        media_progress: Math.max(0, Math.min(100, Math.round(percent))),
        media_progress_stage: stage,
        media_progress_updated_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn(`progress write skipped for ${rowId}: ${e.message || e}`);
  }
}

/** Mark a row's media build failed so the Pending bar shows the failure instead of hanging. */
async function writeMediaFailure(rowId) {
  try {
    await sbFetch(`/rest/v1/${TABLE}?id=eq.${rowId}&workflow_stage=eq.pending`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: {
        media_status: "failed",
        media_progress_stage: "failed",
        media_progress_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn(`failure write skipped for ${rowId}: ${e.message || e}`);
  }
}

const COWORK_JOBS_TABLE = "match_fit_content_cowork_jobs";

/**
 * Write-back added 2026-09-03 (Decision #1722 item 4 + same-date Learning, lane D2): before
 * this, the mini never updated match_fit_content_cowork_jobs at all, so a generate_media job
 * queued by fireMediaAgentForDay/fireMediaAgentForPost sat "queued" or "running" forever from
 * the job-row's point of view even after this script actually finished the post — and the
 * cron drain (content-calendar-generate-media/route.ts) kept treating that same queue as
 * unresolved, re-queueing and clobbering posts the mini had already handled. This closes the
 * loop: whichever queued/running generate_media job's brief references this post id gets
 * marked complete (or failed) here, right after writeMediaResult.
 *
 * Matching is done client-side against the brief JSON (not a DB filter) because a job's brief
 * nests postId under a handful of different order keys (video/static/carousel/...) rather than
 * one fixed column — simplest robust match for what is normally a handful of live rows.
 */
async function findLiveCoworkJobsForPost(postId) {
  const params = new URLSearchParams();
  params.set("select", "id,brief,status");
  params.set("job_type", "eq.generate_media");
  params.set("status", "in.(queued,dispatched,running)");
  const res = await sbFetch(`/rest/v1/${COWORK_JOBS_TABLE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`fetch cowork jobs failed: ${res.status} ${await res.text()}`);
  }
  const jobs = await res.json();
  return jobs.filter((job) => JSON.stringify(job.brief ?? {}).includes(postId));
}

async function patchCoworkJob(jobId, patch) {
  const res = await sbFetch(`/rest/v1/${COWORK_JOBS_TABLE}?id=eq.${jobId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: { updated_at: new Date().toISOString(), ...patch },
  });
  if (!res.ok) {
    throw new Error(`cowork job write-back failed for ${jobId}: ${res.status} ${await res.text()}`);
  }
}

async function completeCoworkJobsForPost(postId, { generationSource }) {
  const jobs = await findLiveCoworkJobsForPost(postId);
  for (const job of jobs) {
    await patchCoworkJob(job.id, {
      status: "complete",
      completed_at: new Date().toISOString(),
      result: { postId, generation_source: generationSource },
      error: null,
    });
  }
  return jobs.length;
}

async function failCoworkJobsForPost(postId, errorMessage) {
  const jobs = await findLiveCoworkJobsForPost(postId);
  for (const job of jobs) {
    await patchCoworkJob(job.id, { status: "failed", error: errorMessage });
  }
  return jobs.length;
}

async function uploadRaw(objectPath, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: buffer,
    }
  );
  if (!res.ok) {
    throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function notifyTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS.length) {
    console.error("Telegram not configured — skipping ping. Message was:\n" + text);
    return;
  }
  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        }
      );
      if (!res.ok) {
        console.error(`telegram send to ${chatId} failed: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      console.error(`telegram send to ${chatId} threw: ${e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Browser automation
// ---------------------------------------------------------------------------

async function connectBrowser() {
  const endpoint = `http://127.0.0.1:${CDP_PORT}`;
  try {
    const browser = await chromium.connectOverCDP(endpoint);
    return browser;
  } catch (e) {
    throw new Error(
      `Could not connect over CDP at ${endpoint}. Is the automation Chrome ` +
        `profile running with --remote-debugging-port=${CDP_PORT}? ` +
        `Run scripts/mini-chrome-automation-launcher.sh first. Underlying error: ${e}`
    );
  }
}

async function getGeminiPage(browser, workDir) {
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  let page = context
    .pages()
    .find((p) => p.url().includes("gemini.google.com"));
  if (!page) {
    page = await context.newPage();
    await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront();
  // The browser-level Browser.setDownloadBehavior CDP command is restricted
  // when connecting to an externally-launched Chrome (this is what the
  // original connectOverCDP crash was about). Page.setDownloadBehavior is
  // the correct, supported per-page replacement for exactly this scenario.
  if (workDir) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: workDir });
  }
  return page;
}

async function assertLoggedIn(page) {
  // Gemini shows a "Sign in" control when logged out, and an account avatar
  // button when logged in. Give the SPA a moment to settle first.
  await page.waitForTimeout(2000);
  const signInVisible = await page
    .getByRole("link", { name: /sign in/i })
    .first()
    .isVisible()
    .catch(() => false);
  if (signInVisible) {
    throw new Error(
      "NOT_LOGGED_IN: the automation Chrome profile is not authenticated into " +
        "JB's Gemini account. This needs a one-time real login on that profile " +
        "(see scripts/mini-chrome-automation-launcher.sh — it bootstraps the " +
        "profile from a copy of the Default profile's session; if that copy is " +
        "stale/expired, JB needs to log in once on the automation profile)."
    );
  }
}

/**
 * JB direct order 2026-09-01/02: Match Fit media is never generated on Flash-tier —
 * only Gemini Pro. The web app defaults to whatever mode was last used in this
 * profile (measured live 2026-09-02: it was sitting on "Flash-Lite"), so every run
 * must explicitly select Pro before generating rather than trusting the account's
 * current mode. Confirmed live 2026-09-02 via DOM probe: the mode-picker button is
 * `button[aria-label*="mode picker"]` (aria-label reads "Open mode picker, currently
 * <Mode>"), and the opened menu's Pro entry is a custom `<gem-menu-item role="menuitem">`
 * reading "3.1 Pro — Advanced reasoning" (version number will drift over time, so this
 * matches on the "Pro" word with a leading version-number prefix, never on "Extended
 * thinking" or anything else in the menu).
 */
async function ensureProModel(page) {
  const modeBtn = page.locator('button[aria-label*="mode picker" i]').first();
  const currentAria = await modeBtn.getAttribute("aria-label").catch(() => "");
  if (/currently[^,]*\bpro\b/i.test(currentAria || "")) {
    return; // already on a Pro-labeled mode — nothing to do
  }
  await modeBtn.click();
  await page.waitForTimeout(800);

  const proItem = page.getByRole("menuitem", { name: /^\s*\d+(\.\d+)?\s+pro\b/i }).first();
  const proVisible = await proItem.isVisible().catch(() => false);
  if (!proVisible) {
    await page.keyboard.press("Escape").catch(() => null);
    throw new Error("PRO_MODE_OPTION_NOT_FOUND: mode picker opened but no '<N> Pro' menu item was visible.");
  }
  await proItem.click();
  await page.waitForTimeout(800);

  const afterAria = await modeBtn.getAttribute("aria-label").catch(() => "");
  if (!/currently[^,]*\bpro\b/i.test(afterAria || "")) {
    throw new Error(
      `PRO_MODE_NOT_CONFIRMED: clicked the Pro menu item but the mode picker still reads "${afterAria}".`,
    );
  }
}

async function startNewChat(page) {
  const newChatBtn = page.getByText("New chat", { exact: true }).first();
  if (await newChatBtn.isVisible().catch(() => false)) {
    await newChatBtn.click().catch(() => null);
    await page.waitForTimeout(1500);
  }
}

async function generateAndDownload(page, visualPrompt, workDir) {
  const imgSel = 'generated-image, img[src*="generativelanguage"], [data-test-id="generated-image"]';
  const beforeCount = await page.locator(imgSel).count().catch(() => 0);

  const composer = page.locator('div[contenteditable="true"]').first();
  await composer.click();
  await composer.fill("");
  await page.keyboard.insertText(visualPrompt);
  await page.keyboard.press("Enter");

  // Wait for the image COUNT to genuinely increase, not just "any image visible"
  // -- the latter can resolve instantly against a stale prior-turn image if the
  // new one has not rendered yet, producing a silent duplicate.
  const deadline = Date.now() + 120_000;
  let afterCount = beforeCount;
  while (Date.now() < deadline) {
    afterCount = await page.locator(imgSel).count().catch(() => beforeCount);
    if (afterCount > beforeCount) break;
    await page.waitForTimeout(1000);
  }
  if (afterCount <= beforeCount) {
    await page.screenshot({ path: '/tmp/gemini-fail-debug.png', fullPage: false }).catch(() => null);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.error('DEBUG_BODY_SNIPPET: ' + bodyText.slice(0,800).split(String.fromCharCode(10)).join(' | '));
    throw new Error('NEW_IMAGE_NEVER_APPEARED: count stayed at ' + beforeCount + ' after 120s.');
  }
  const imageLocator = page.locator(imgSel).last();
  await imageLocator.waitFor({ state: "visible", timeout: 15_000 });
  await imageLocator.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" })).catch(() => null);
  await imageLocator.hover();
  await page.waitForTimeout(1000);

  // Use 'Copy image' + clipboard read instead of the Download button --
  // the download button likely triggers a native OS save-file picker via
  // the File System Access API, which Playwright/CDP cannot see or drive.
  // Copy-to-clipboard stays entirely inside the page/browser process.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://gemini.google.com" }).catch((e) => console.error("grantPermissions failed: " + e));

  const copyBtn = page.locator('button[aria-label="Copy image"]').last();
  let copyClicked = false;
  for (let attempt = 0; attempt < 6 && !copyClicked; attempt++) {
    await imageLocator.hover().catch(() => null);
    await page.waitForTimeout(800);
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      copyClicked = true;
    }
  }
  if (!copyClicked) {
    await page.screenshot({ path: "/tmp/gemini-fail-debug.png", fullPage: false }).catch(() => null);
    throw new Error("COPY_BUTTON_NOT_FOUND: could not find/click Copy image button after 6 attempts.");
  }
  await page.bringToFront();
  await page.locator("body").click({ position: { x: 5, y: 5 }, force: true }).catch(() => null);
  await page.waitForTimeout(1500);

  // The OS/browser clipboard write triggered by the "Copy image" click is not always
  // immediately visible to clipboard.read() — observed live 2026-09-02 (a real Carousel
  // generation failed on the very first slide with the clipboard read racing ahead of the
  // write). Retry a few times with a short backoff before giving up.
  async function readClipboardImage() {
    return page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const buf = await blob.arrayBuffer();
            let binary = "";
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary);
          }
        }
      }
      return null;
    }).catch((e) => {
      console.error("clipboard read failed: " + e);
      return null;
    });
  }

  let base64 = null;
  for (let attempt = 0; attempt < 4 && !base64; attempt++) {
    if (attempt > 0) await page.waitForTimeout(1000);
    base64 = await readClipboardImage();
  }

  if (!base64) {
    await page.screenshot({ path: "/tmp/gemini-fail-debug.png", fullPage: false }).catch(() => null);
    throw new Error("CLIPBOARD_READ_FAILED: Copy image was clicked but clipboard.read() returned no image data.");
  }

  const savePath = path.join(workDir, `raw-${Date.now()}.png`);
  fs.writeFileSync(savePath, Buffer.from(base64, "base64"));
  return savePath;
}

async function cropWhiteFrame(rawPath) {
  const input = fs.readFileSync(rawPath);
  // Gemini's watermark/frame lands as a uniform light border — .trim()
  // removes uniform-color edges. threshold widened slightly past the sharp
  // default (10) because the frame is near-white, not pure #fff.
  const cropped = await sharp(input).trim({ background: "#ffffff", threshold: 24 }).toBuffer();
  return cropped;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, v] = arg.slice(2).split("=");
    out[k] = v ?? true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.check) {
    // Diagnostic-only mode: confirm CDP reachable + Gemini session logged in,
    // without generating anything. Used before committing to a real batch.
    const browser = await connectBrowser();
    const page = await getGeminiPage(browser);
    try {
      await assertLoggedIn(page);
      await ensureProModel(page);
      console.log("CHECK_OK: CDP reachable, Gemini session is logged in, mode is Pro.");
    } finally {
      await browser.close().catch(() => null);
    }
    return;
  }

  let ids = args.ids ? args.ids.split(",").filter(Boolean) : null;
  let postDate = args["post-date"];
  let postGroup = args["post-group"];

  if (args.payload) {
    const payload = JSON.parse(fs.readFileSync(args.payload, "utf8"));
    ids = payload.ids || ids;
    postDate = payload.post_date || postDate;
    postGroup = payload.post_group || postGroup;
  }

  if (!ids && !postDate) {
    console.error("Usage: --ids=uuid,uuid | --post-date=YYYY-MM-DD [--post-group=5pm] | --payload=file.json");
    process.exit(2);
  }

  const rows = await fetchRows({ ids, postDate, postGroup });
  // Explicit --ids trusts the caller's own gate (v2's fireCoworkForPost/fireCoworkForDay
  // already staged these at workflow_stage="pending"). Date-batch mode keeps the
  // older status="approved" contract, already enforced by fetchRows' query filter.
  const pending = ids && ids.length
    ? rows.filter((r) => r.media_status !== "ready")
    : rows.filter((r) => r.media_status !== "ready" && r.status === "approved");

  if (!pending.length) {
    console.log(`No pending rows (fetched ${rows.length}, all already ready or not approved).`);
    return;
  }

  console.log(`Processing ${pending.length} row(s): ${pending.map((r) => r.id).join(", ")}`);

  // Show the operator the bar has started before the (slow) browser connect + Pro-mode check.
  for (const row of pending) await writeProgress(row.id, 5, "connecting");

  const browser = await connectBrowser();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "nvg-gemini-"));
  const page = await getGeminiPage(browser, workDir);
  await assertLoggedIn(page);
  await ensureProModel(page);
  for (const row of pending) await writeProgress(row.id, 12, "model_pro");
  const results = [];
  const errors = [];

  for (const row of pending) {
    try {
      // Start each post in a fresh Gemini conversation — otherwise one row's brand/
      // audience context can bleed into the next row's image (e.g. a Video post's
      // prompt influencing the following Carousel's composition).
      await startNewChat(page);
      // Prefer last_generation_prompt — Content Calendar v2's fully-formatted
      // production prompt (dimensions, brand colors, JB's locked creative-quality
      // rules) built by buildMediaGenerationPrompt(). Raw visual_prompt is only
      // the earlier creative brief and is the fallback for older/date-batch rows
      // that never got a formatted prompt written.
      const prompt = row.last_generation_prompt || row.visual_prompt;
      if (!prompt) {
        throw new Error("row has no last_generation_prompt or visual_prompt — nothing to generate from");
      }
      // Carousels may pack multiple prompts separated by "---SLIDE---";
      // everything else is a single-image generation.
      const slidePrompts = String(prompt)
        .split(/---\s*SLIDE\s*---/i)
        .map((s) => s.trim())
        .filter(Boolean);

      const mediaUrls = [];
      let slideIdx = 0;
      const slideCount = slidePrompts.length;
      // 15% (starting) → 90% (last upload) across all slides, so the bar tracks real work.
      const slideSpan = (idx, frac) => 15 + Math.round(((idx - 1 + frac) / slideCount) * 75);
      for (const slidePrompt of slidePrompts) {
        slideIdx += 1;
        await writeProgress(row.id, slideSpan(slideIdx, 0), "generating");
        const rawPath = await generateAndDownload(page, slidePrompt, workDir);
        await writeProgress(row.id, slideSpan(slideIdx, 0.5), "cropping");
        const cropped = await cropWhiteFrame(rawPath);
        await writeProgress(row.id, slideSpan(slideIdx, 0.8), "uploading");
        const objectPath = `${row.post_date}/${row.id}-slide${slideIdx}-${Date.now()}.png`;
        const publicUrl = await uploadRaw(objectPath, cropped, "image/png");
        mediaUrls.push(publicUrl);
        fs.unlinkSync(rawPath);
      }

      await writeMediaResult(row.id, mediaUrls);
      const closedJobs = await completeCoworkJobsForPost(row.id, {
        generationSource: "chrome_agent_gemini_pro",
      }).catch((e) => {
        console.error(`WARN ${row.id}: writeMediaResult succeeded but cowork job write-back failed: ${e.message || e}`);
        return 0;
      });
      results.push({ id: row.id, post_type: row.post_type, mediaUrls, closedJobs });
      console.log(`OK ${row.id} (${row.post_type}) -> ${mediaUrls.length} asset(s), ${closedJobs} cowork job(s) closed`);
    } catch (e) {
      const message = String(e.message || e);
      errors.push({ id: row.id, post_type: row.post_type, error: message });
      console.error(`FAIL ${row.id}: ${message}`);
      await writeMediaFailure(row.id);
      await failCoworkJobsForPost(row.id, message).catch((e2) => {
        console.error(`WARN ${row.id}: failed to write the failure back to cowork jobs too: ${e2.message || e2}`);
      });
      // Do not throw — keep going so one bad row doesn't stall the batch.
    }
  }

  await browser.close().catch(() => null);

  const summaryLines = [
    `Match Fit media generation batch finished.`,
    `Ready for review: ${results.length}`,
    ...results.map((r) => `  - ${r.post_type} (${r.id.slice(0, 8)}): ${r.mediaUrls.length} asset(s)`),
  ];
  if (errors.length) {
    summaryLines.push(`Failed: ${errors.length}`);
    summaryLines.push(...errors.map((e) => `  - ${e.post_type} (${e.id.slice(0, 8)}): ${e.error}`));
  }
  await notifyTelegram(summaryLines.join("\n"));

  console.log(JSON.stringify({ results, errors }, null, 2));
  if (errors.length && !results.length) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e.stack || e);
  notifyTelegram(`Match Fit Gemini automation crashed: ${e.message || e}`).finally(() => {
    process.exit(1);
  });
});
