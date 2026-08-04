/**
 * NI Services lead sourcing — candidate probing only. WRITES NOTHING and SENDS NOTHING.
 *
 * Reads candidate domains (one per line) from the file given as argv[2], probes each one, and
 * prints a JSON candidate list to stdout. The insert is a separate, deliberate step so a
 * discovery run can never create a lead by accident.
 *
 * RULES BAKED IN:
 *   - NO GEOGRAPHY. No city, no region, no lat/long is used to find, filter or describe a
 *     candidate. NI Services is sold online to any company, any industry, B2B and B2C alike,
 *     so location is not a selection signal and is never written onto a lead.
 *   - Email trust is NOT re-implemented here: it imports `findContactEmail` from the Match Fit
 *     nationwide finder, so an address is accepted only on the business's own domain or a known
 *     personal provider. A third-party address is dropped rather than guessed at.
 *   - Free tier only: plain fetches. No paid API, no LLM call.
 *
 * The probe signals (mobile viewport, page platform, page weight, HTTPS, title) are what a
 * concrete deliverable is written from — a pitch has to name the actual thing NI would hand over.
 */

import { readFileSync } from "node:fs";
import { findContactEmail } from "../src/lib/outreach-nationwide-finder";

type Candidate = {
  host: string;
  website: string;
  email: string;
  siteTitle: string | null;
  platform: string | null;
  hasViewport: boolean | null;
  bytes: number | null;
  httpsOk: boolean;
};

/** Cheap, honest signals about the site — the raw material for a concrete deliverable. */
async function probeSite(website: string) {
  try {
    const r = await fetch(website, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { siteTitle: null, platform: null, hasViewport: null, bytes: null, httpsOk: false };
    const html = await r.text();
    const title = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, " ") ?? null;
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    let platform: string | null = null;
    if (/wp-content|wp-includes/i.test(html)) platform = "WordPress";
    else if (/squarespace/i.test(html)) platform = "Squarespace";
    else if (/wixstatic|wix\.com/i.test(html)) platform = "Wix";
    else if (/cdn\.shopify|shopify/i.test(html)) platform = "Shopify";
    else if (/webflow/i.test(html)) platform = "Webflow";
    else if (/godaddy|websitebuilder/i.test(html)) platform = "GoDaddy builder";
    else if (/duda|dudamobile/i.test(html)) platform = "Duda";
    return { siteTitle: title, platform, hasViewport, bytes: html.length, httpsOk: true };
  } catch {
    return { siteTitle: null, platform: null, hasViewport: null, bytes: null, httpsOk: false };
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/ni-services-lead-source.mts <domains.txt>");
    process.exit(1);
  }
  const hosts = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));

  const out: Candidate[] = [];
  const CONCURRENCY = 6;

  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (host) => {
        const website = `https://${host}`;
        const [email, probe] = await Promise.all([findContactEmail(website), probeSite(website)]);
        return { host, website, email, probe };
      }),
    );
    for (const r of results) {
      if (!r.email) {
        console.error(`  - ${r.host} (no trusted address)`);
        continue; // no trusted address -> not a lead, never a guess
      }
      out.push({ host: r.host, website: r.website, email: r.email, ...r.probe });
      console.error(`  + ${r.host} -> ${r.email} [${r.probe.platform ?? "custom"}, viewport=${r.probe.hasViewport}]`);
    }
  }

  console.log(JSON.stringify(out, null, 2));
  console.error(`\nProbed ${hosts.length}; candidates with a trusted email: ${out.length}`);
}

void main();
