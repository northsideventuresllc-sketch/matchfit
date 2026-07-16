#!/usr/bin/env node
/**
 * Verify Meta Conversions API can accept a server event for Match Fit.
 *
 * Requires:
 * - META_PIXEL_ID: Events Manager pixel id (same as src/lib/meta-pixel.ts)
 * - META_ACCESS_TOKEN: Conversions API system-user token from Events Manager
 *   (falls back to META_ADS_ACCESS_TOKEN when unset)
 *
 * Usage:
 *   node --env-file=.env scripts/verify-meta-capi.mjs
 *   META_PIXEL_ID=… META_ACCESS_TOKEN=… node scripts/verify-meta-capi.mjs
 */
import { createHash, randomUUID } from "node:crypto";

const pixelId = process.env.META_PIXEL_ID?.trim();
const dedicated = process.env.META_ACCESS_TOKEN?.trim();
const adsFallback = process.env.META_ADS_ACCESS_TOKEN?.trim();
const accessToken = dedicated || adsFallback;

if (!pixelId || !accessToken) {
  console.error("Set META_PIXEL_ID and META_ACCESS_TOKEN (or META_ADS_ACCESS_TOKEN fallback).");
  process.exit(1);
}

const eventTime = Math.floor(Date.now() / 1000);
const eventId = `mf_capi_verify_${eventTime}_${randomUUID().slice(0, 8)}`;
const em = createHash("sha256").update("capi-verify@match-fit.net").digest("hex");

const res = await fetch(
  `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          event_name: "Lead",
          event_time: eventTime,
          event_id: eventId,
          action_source: "website",
          event_source_url: "https://match-fit.net/",
          user_data: { em: [em] },
          custom_data: { match_fit_event: "mf_capi_verify", content_name: "Match Fit CAPI verify" },
        },
      ],
    }),
  },
);

const text = await res.text();
let json = {};
try {
  json = text ? JSON.parse(text) : {};
} catch {
  // ignore
}

if (!res.ok || json.error) {
  const msg = json.error?.message ?? `HTTP ${res.status}`;
  console.error(`Meta CAPI failed for pixel ${pixelId}: ${msg}`);
  console.error(
    "Fix: Events Manager → Settings → Conversions API → Generate access token (system user with pixel access). Env alone is not enough.",
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pixelId,
      events_received: json.events_received ?? 1,
      fbtrace_id: json.fbtrace_id ?? null,
      usedAdsTokenFallback: !dedicated && Boolean(adsFallback),
      note: "CAPI accepted the probe event. Check Events Manager → Test Events if using a test_event_code.",
    },
    null,
    2,
  ),
);
