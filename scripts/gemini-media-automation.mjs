#!/usr/bin/env node
/**
 * GEMINI MEDIA AUTOMATION — headless, CDP-driven (JB direct order, 2026-08-13)
 * -----------------------------------------------------------------------------
 * Replaces the desktop-bridge-only "generate in Gemini, download, crop, upload"
 * step of WF1 (Match Fit marketing, steps 3-9) with something callable from a
 * scheduled/cloud session that has NO desktop bridge.
 *
 * Runs ON THE MAC MINI (invoked by nvg-mini-runner.py, kind="gemini_generate",
 * or directly via `node gemini-media-automation.mjs <payload.json>`).
 * Never runs in a cloud session — it needs the mini's local Chrome + CDP port.
 *
 * What it does, per approved content_calendar_posts row:
 *   1. Attach to the dedicated automation Chrome profile over CDP (does not
 *      touch JB's live logged-in Chrome — separate --user-data-dir + port).
 *   2. Open Gemini, paste visual_prompt, generate, wait for the image(s).
 *   3. Download each generated image via Gemini's own download control
 *      (page.waitForEvent('download') — never scrape a blob URL blind).
 *   4. Crop the white frame Gemini stamps on every output (sharp .trim()).
 *   5. Upload the cropped asset to Supabase Storage bucket
 *      content-calendar-media (NI-Brain project kxijunwgbrlfzvgkhklo).
 *   6. Write media_urls (slide order) + media_status='ready' onto the
 *      matching match_fit_content_calendar_posts row. NEVER touches `status`
 *      (posting approval) — that stays JB-gated, always.
 *   7. Pings JB on Telegram when a batch finishes.
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

async function fetchApprovedRows({ ids, postDate, postGroup }) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,post_date,post_group,post_type,target_group,visual_prompt,caption,media_status,media_urls,status"
  );
  if (ids && ids.length) {
    params.set("id", `in.(${ids.join(",")})`);
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

async function writeMediaResult(rowId, mediaUrls, statusLabel) {
  const res = await sbFetch(`/rest/v1/${TABLE}?id=eq.${rowId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      media_urls: mediaUrls,
      media_status: statusLabel,
      updated_at: new Date().toISOString(),
      // NEVER touch `status` — posting approval stays JB-gated.
    },
  });
  if (!res.ok) {
    throw new Error(`write-back failed for ${rowId}: ${res.status} ${await res.text()}`);
  }
  return res.json();
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

async function getGeminiPage(browser) {
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

async function generateAndDownload(page, visualPrompt, workDir) {
  const composer = page.locator('div[contenteditable="true"]').first();
  await composer.click();
  await composer.fill(""); // clear any stale draft
  await composer.type(visualPrompt, { delay: 5 });
  await page.keyboard.press("Enter");

  // Wait for a generated image to appear in the latest response.
  const imageLocator = page
    .locator('generated-image, img[src*="generativelanguage"], [data-test-id="generated-image"]')
    .last();
  await imageLocator.waitFor({ state: "visible", timeout: 120_000 });

  // Hover to reveal per-image controls, then use Gemini's own download action
  // rather than scraping the src (blob: URLs won't survive a raw fetch, and
  // this is exactly what a human does — matches the standing "no untrusted
  // injected inputs" doctrine from the mini's operating rules).
  await imageLocator.hover();
  const moreOptions = page
    .locator('button[aria-label*="More" i], button[aria-label*="options" i]')
    .last();
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);

  let download = null;
  if (await moreOptions.isVisible().catch(() => false)) {
    await moreOptions.click();
    const downloadItem = page.getByText(/download/i).last();
    await downloadItem.click({ timeout: 10_000 }).catch(() => null);
    download = await downloadPromise;
  }

  if (!download) {
    // Fallback route: some Gemini surfaces expose a direct download button
    // on the image itself rather than a kebab menu.
    const directDownloadBtn = page
      .locator('button[aria-label*="Download" i]')
      .last();
    if (await directDownloadBtn.isVisible().catch(() => false)) {
      const p2 = page.waitForEvent("download", { timeout: 30_000 });
      await directDownloadBtn.click();
      download = await p2.catch(() => null);
    }
  }

  if (!download) {
    throw new Error(
      "DOWNLOAD_UI_NOT_FOUND: generated an image but could not find Gemini's " +
        "download control (selectors may have drifted — needs a live DOM check)."
    );
  }

  const savePath = path.join(workDir, `raw-${Date.now()}.png`);
  await download.saveAs(savePath);
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
      console.log("CHECK_OK: CDP reachable, Gemini session is logged in.");
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

  const rows = await fetchApprovedRows({ ids, postDate, postGroup });
  const pending = rows.filter((r) => r.media_status !== "ready" && r.status === "approved");

  if (!pending.length) {
    console.log(`No pending rows (fetched ${rows.length}, all already ready or not approved).`);
    return;
  }

  console.log(`Processing ${pending.length} row(s): ${pending.map((r) => r.id).join(", ")}`);

  const browser = await connectBrowser();
  const page = await getGeminiPage(browser);
  await assertLoggedIn(page);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "nvg-gemini-"));
  const results = [];
  const errors = [];

  for (const row of pending) {
    try {
      if (!row.visual_prompt) {
        throw new Error("row has no visual_prompt — nothing to generate from");
      }
      // Carousels may pack multiple prompts separated by "---SLIDE---";
      // everything else is a single-image generation.
      const slidePrompts = String(row.visual_prompt)
        .split(/---\s*SLIDE\s*---/i)
        .map((s) => s.trim())
        .filter(Boolean);

      const mediaUrls = [];
      let slideIdx = 0;
      for (const slidePrompt of slidePrompts) {
        slideIdx += 1;
        const rawPath = await generateAndDownload(page, slidePrompt, workDir);
        const cropped = await cropWhiteFrame(rawPath);
        const objectPath = `${row.post_date}/${row.id}-slide${slideIdx}-${Date.now()}.png`;
        const publicUrl = await uploadRaw(objectPath, cropped, "image/png");
        mediaUrls.push(publicUrl);
        fs.unlinkSync(rawPath);
      }

      await writeMediaResult(row.id, mediaUrls, "ready");
      results.push({ id: row.id, post_type: row.post_type, mediaUrls });
      console.log(`OK ${row.id} (${row.post_type}) -> ${mediaUrls.length} asset(s)`);
    } catch (e) {
      errors.push({ id: row.id, post_type: row.post_type, error: String(e.message || e) });
      console.error(`FAIL ${row.id}: ${e.message || e}`);
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
