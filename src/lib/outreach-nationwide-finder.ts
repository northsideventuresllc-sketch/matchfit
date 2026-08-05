/**
 * Match Fit outreach lead finder — online / virtual coaches, nationwide.
 *
 * Every weekday this produces a fixed small batch of leads on TWO independent lanes and leaves a
 * draft message on each, ready for JB to edit:
 *
 *   Instagram lane — coaches who describe themselves as online / remote / virtual coaches in
 *                    their bio. `handle` is the required field; `email` is normally null here.
 *   Email lane     — independent online coaching businesses with a real contact address on
 *                    their own site (see `findContactEmail`).
 *
 * STORAGE (fixed 2026-08-05, OUT-STORE-MISMATCH-LEADS-INVISIBLE): writes go straight into Match
 * Fit's OWN Prisma-modeled tables (`OutreachInstagramLead` / `OutreachEmailLead`, Match Fit
 * Supabase project) via `@/lib/prisma` — the exact tables the Outreach HQ admin screen
 * (`src/app/api/admin/outreach/leads/*`) reads. Every lead lands in the `today` lane, same as an
 * admin-triggered "Generate" batch, so it goes through the SAME approve/reject/follow-up pipeline
 * JB already uses daily. This file previously wrote to NI-Brain's legacy `outreach_leads` /
 * `outreach_messages` tables via raw Supabase REST — nothing in the Match Fit app ever read those
 * tables, so every lead this finder produced was permanently invisible to JB and the review loop
 * never closed. Do not reintroduce a second store: one finder, one set of tables, matching what
 * the screen JB actually looks at reads.
 *
 * NOT geo-targeted. There is no city, no lat/long and no polygon anywhere in this file. Match Fit geo-guard:allow
 * recruits online/virtual coaches across the whole country, so scoping discovery to a metro area
 * was throwing away almost every real candidate. `city` is never written for the
 * same reason — an online coach's location is not a matching signal and guessing one is worse
 * than leaving it empty.
 *
 * Never touches automation_controls, never approves and never sends. No paid API: SerpApi web
 * search (free tier) plus plain-text template fill, no LLM call.
 *
 * Env: SERPAPI_API_KEY — lives in `platform_secrets` and is loaded by
 * `hydratePlatformEnvFromDatabase()` in the cron route.
 */
import "server-only";

import { prisma } from '@/lib/prisma';
import { ensureOutreachHubSchema } from '@/lib/ensure-outreach-hub-schema';
import { getOutreachExclusionList, normalizeEmail, normalizeInstagramHandle } from '@/lib/outreach-exclusions';
import { startOfEstDayUtc } from '@/lib/outreach-lanes';
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from '@/lib/outreach-axon-notify';

/** Leads to insert per lane per run. A lane that can only find fewer inserts fewer. */
export const LEADS_PER_LANE = 5;

/**
 * SerpApi searches per lane per run. The free plan allows 100 searches/month and this runs ~22
 * weekdays, so the whole run has to fit in ~4 searches: 2 per lane. Each search asks for
 * `RESULTS_PER_SEARCH` results, which still counts as one search, so widening the page is how we
 * get enough candidates without spending more quota.
 */
export const MAX_SEARCHES_PER_LANE = 2;
const RESULTS_PER_SEARCH = 30;

const INSTAGRAM_SOURCE = 'instagram_online_coach_search';
const EMAIL_SOURCE = 'web_online_coach_search';

/** Bio / hashtag language online coaches actually use to describe themselves. */
const ONLINE_COACH_SIGNALS = [
  'online coach',
  'online coaching',
  'online trainer',
  'online personal trainer',
  'online personal training',
  'online fitness coach',
  'remote coaching',
  'remote coach',
  'virtual trainer',
  'virtual training',
  'virtual coaching',
  'coaching online',
  'train online',
  'training online',
  'onlinecoach',
  'onlinecoaching',
  'onlinetrainer',
  'onlinepersonaltrainer',
  'remotecoaching',
  'virtualtrainer',
];

/** Link-in-bio hosts an online coach uses to sell/intake — a strong "actually takes clients" tell. */
const LINK_IN_BIO_HOSTS = [
  'linktr.ee',
  'beacons.ai',
  'stan.store',
  'linkin.bio',
  'bio.link',
  'trainerize',
  'everfit',
  'calendly.com',
  'typeform.com',
];

/**
 * Instagram search queries. Two are used per run, rotated by day so the pool is worked through
 * across the week instead of hammering the same page every morning.
 */
const INSTAGRAM_QUERIES = [
  'site:instagram.com "online coach" fitness "link in bio"',
  'site:instagram.com "online coaching" "personal trainer"',
  'site:instagram.com "remote coaching" fitness coach',
  'site:instagram.com "virtual trainer" workouts clients',
  'site:instagram.com "online personal trainer" "DM me"',
  'site:instagram.com "coaching online" fitness "linktr.ee"',
  'site:instagram.com "online fitness coach" "stan.store"',
  'site:instagram.com "online coaching" "spots open"',
];

/** Email-lane queries: independent coaching businesses with their own site, nationwide. */
const EMAIL_QUERIES = [
  '"online coaching" "personal trainer" contact -site:instagram.com -site:facebook.com -site:yelp.com',
  '"online personal training" independent coach "contact us"',
  '"virtual personal training" coach contact email -site:linkedin.com',
  '"remote coaching" fitness coach "work with me" contact',
  '"online fitness coaching" "apply" coach contact',
  '"train with me online" coach contact',
];

/**
 * Hosts that are never an independent coach we can pitch: directories, marketplaces, forums,
 * publishers, cert bodies, big-box gym chains, and our own site. Anything here is dropped before
 * we spend a page fetch on it.
 */
const EXCLUDED_HOSTS = [
  'match-fit.net',
  'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com',
  'linkedin.com', 'pinterest.com', 'reddit.com', 'quora.com', 'medium.com', 'substack.com',
  'yelp.com', 'thumbtack.com', 'bark.com', 'indeed.com', 'ziprecruiter.com', 'glassdoor.com',
  'upwork.com', 'fiverr.com', 'wikipedia.org', 'amazon.com', 'apple.com', 'google.com',
  'trainerize.com', 'everfit.io', 'mytrainerize.com', 'truecoach.co', 'ptdistinction.com',
  'fitbudd.com', 'trainheroic.com', 'teambuildr.com', 'mindbodyonline.com', 'wellnessliving.com',
  'menshealth.com', 'womenshealthmag.com', 'healthline.com', 'verywellfit.com', 'webmd.com',
  'shape.com', 'self.com', 'garagegymreviews.com', 'nytimes.com', 'forbes.com', 'businessinsider.com',
  'nasm.org', 'issaonline.com', 'acefitness.org', 'acsm.org', 'afaa.com', 'ncsf.org',
  // Added 2026-08-04 (OUT-VERIFY-NATIONWIDE-RUN). Every host on this line actually reached JB's
  // approval queue as a "lead" on 2026-07-29: a Fortune staff writer, a Harvard/Emeritus course
  // desk, and three companies that sell coaching software or coaching certifications — i.e.
  // competitors and publishers, not coaches we can pitch.
  'fortune.com', 'time.com', 'cnn.com', 'msn.com', 'yahoo.com', 'buzzfeed.com', 'cnet.com',
  'usatoday.com', 'washingtonpost.com', 'wsj.com', 'gq.com', 'esquire.com', 'popsugar.com',
  'sportskeeda.com', 'livestrong.com', 'eatthis.com', 'prevention.com', 'runnersworld.com',
  'emeritus.org', 'harvard.edu', 'coursera.org', 'udemy.com', 'edx.org', 'skillshare.com',
  'opexfit.com', 'fitnessmentors.com', 'showupfitness.com', 'ptpioneer.com', 'exercise.com',
  'kajabi.com', 'teachable.com', 'thinkific.com', 'podia.com', 'wix.com', 'squarespace.com',
  'planetfitness.com', 'anytimefitness.com', 'orangetheory.com', 'equinox.com', 'lifetime.life',
  'crunch.com', 'goldsgym.com', 'ymca.org', '24hourfitness.com', 'f45training.com',
  'barrys.com', 'soul-cycle.com', 'soulcycle.com', 'clubpilates.com', 'orangetheoryfitness.com',
  'peloton.com', 'nike.com', 'underarmour.com', 'myfitnesspal.com', 'noom.com', 'future.co',
  // Added 2026-08-05 (OUT-EMAIL-LANE-PRODUCT-FILTER). rackcoach.com reached JB's queue as a
  // "coach" — it is weight-room management SOFTWARE, not an individual coach's own site. One
  // measured host plus the shape-based looksLikeCoachingProduct() below, same reasoning as the
  // article filter: a blocklist alone can never keep up with the next SaaS entrant.
  'rackcoach.com',
];

type SerpOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
  /** SerpApi carries the Instagram account name here, e.g. "Instagram · thepatcallahan". */
  source?: string;
};

export type LaneName = 'instagram' | 'email';

export type LaneStats = {
  lane: LaneName;
  searches: number;
  candidates: number;
  rejected: number;
  duplicate: number;
  noEmail: number;
  inserted: number;
  drafted: number;
  shortfall: number;
  /** Plain-language note when the lane could not reach its target, or failed outright. */
  note: string | null;
};

export type FinderRunSummary = {
  target: number;
  lanes: LaneStats[];
  inserted: number;
  drafted: number;
  shortfall: number;
};

function emptyLaneStats(lane: LaneName): LaneStats {
  return {
    lane,
    searches: 0,
    candidates: 0,
    rejected: 0,
    duplicate: 0,
    noEmail: 0,
    inserted: 0,
    drafted: 0,
    shortfall: 0,
    note: null,
  };
}

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/** Zero-based day index used to rotate which queries a run uses. */
export function rotationOffset(now: Date): number {
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - startOfYear) / 86_400_000);
}

/** Picks `count` queries from `pool`, rotated by day so the whole pool gets used over time. */
export function pickQueries(pool: string[], count: number, now: Date): string[] {
  const offset = rotationOffset(now) * count;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}

/** Plain web search. No `location`, no `ll`, no `uule` — results are nationwide on purpose. */
async function webSearch(query: string): Promise<SerpOrganicResult[]> {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    num: String(RESULTS_PER_SEARCH),
    hl: 'en',
    gl: 'us',
    api_key: env('SERPAPI_API_KEY'),
  });
  const r = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`SerpApi HTTP ${r.status} for "${query}"`);
  const data = (await r.json()) as { organic_results?: SerpOrganicResult[] };
  return data.organic_results ?? [];
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isExcludedHost(host: string): boolean {
  return EXCLUDED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Instagram paths that are not a profile. */
const INSTAGRAM_RESERVED_PATHS = new Set([
  'p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'directory', 'developer',
  'about', 'legal', 'web', 'graphql', 'challenge', 'privacy', 'terms', 'help', 'session',
  'emails', 'push', 'ads', 'business', 'creators', 'blog', 'igtv', 'locations',
]);

/**
 * Pulls the profile handle out of an Instagram URL. Post/reel/section URLs and anything that
 * isn't a plain `/handle` path return null, so we never draft a DM to `@reel`.
 */
export function instagramHandleFrom(url: string): string | null {
  const host = hostnameOf(url);
  if (!host || !(host === 'instagram.com' || host.endsWith('.instagram.com'))) return null;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0].toLowerCase();
  if (INSTAGRAM_RESERVED_PATHS.has(first)) return null;
  // A profile URL is `/handle` or `/handle/` — deeper paths are posts, tagged, reels, etc.
  if (segments.length > 1) return null;
  if (!/^[a-z0-9._]{2,30}$/.test(first)) return null;
  return first;
}

/**
 * MEASURED 2026-08-04: Google returns ZERO bare `instagram.com/<handle>` profile URLs for the
 * `site:instagram.com` queries this lane uses. All 10 organic results for
 * `site:instagram.com "online fitness coach" "stan.store"` were `/p/...` or `/reel/...` post URLs,
 * so `instagramHandleFrom` correctly rejected every one and the lane returned 0 of 5 leads —
 * not a filter bug, a source bug.
 *
 * The handle IS present: SerpApi puts it in the result's `source` field as
 * `"Instagram · thepatcallahan"`. This reads it from there when the link alone cannot give one,
 * so a post result becomes the profile behind it. Still refuses anything that is not a plausible
 * handle, so we never draft a DM to `@reel`.
 */
export function instagramHandleFromResult(res: {
  link?: string;
  source?: string;
  displayed_link?: string;
}): string | null {
  if (res.link) {
    const direct = instagramHandleFrom(res.link);
    if (direct) return direct;
  }
  for (const raw of [res.source, res.displayed_link]) {
    if (!raw) continue;
    // "Instagram · thepatcallahan", "Instagram > coach.jane", "instagram.com › coach.jane"
    const tail = raw.split(/[·›>]/).pop()?.trim().toLowerCase();
    if (!tail) continue;
    const candidate = tail.replace(/^@/, '').replace(/\/+$/, '');
    if (!/^[a-z0-9._]{2,30}$/.test(candidate)) continue;
    if (INSTAGRAM_RESERVED_PATHS.has(candidate)) continue;
    if (candidate === 'instagram' || candidate === 'instagram.com') continue;
    return candidate;
  }
  return null;
}

/**
 * True when a search result is a magazine article, listicle or how-to guide rather than a
 * coach's own site.
 *
 * Measured on the 2026-07-29 batch: 5 of 14 rows JB was asked to approve had an ARTICLE TITLE
 * sitting in the company field — "Best Online Personal Trainers (2026): Expert Tested",
 * "The 6 Best Online Nutrition Coaches in 2025", "How to Become an Online Personal Trainer in
 * 2026". A host blocklist can never catch these on its own because a new publisher appears every
 * week; the shape of the headline is the durable signal.
 */
export function looksLikeArticle(title: string, url?: string): boolean {
  const t = title.trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /\b(19|20)\d{2}\b/,                                   // a year in the title
    /\bbest\b/i,                                          // "Best Online Personal Trainers"
    /\btop\s*\d+\b/i,                                     // "Top 10 ..."
    /^\s*\d+\s+(best|top|great|amazing|ways|reasons|tips)/i, // "6 Best ...", "7 Ways ..."
    /\bhow\s+to\b/i,
    /\b(guide|ultimate guide|complete guide|checklist|roundup|round-up)\b/i,
    /\b(review|reviews|ranked|rated|expert[- ]tested|we tested|compared|comparison)\b/i,
    /\bvs\.?\b/i,
    /\b(average cost|cost of|how much (does|do)|price of|pricing guide)\b/i,
    /\b(what is|why you|should you|do you need)\b/i,
  ];
  if (patterns.some((p) => p.test(t))) return true;
  // A result living under a blog/article path is publisher content even if the headline is plain.
  if (url && /\/(blog|blogs|article|articles|news|magazine|guides?|resources|learn)\//i.test(url)) return true;
  return false;
}

/**
 * A readable business name for the lead. Falls back to the domain when the page title is an
 * article headline, so JB never opens a queue row addressed to "Average Cost of Online Personal
 * Trainer Per Month: 2026 ...". Kept separate from the reject decision on purpose: a real coach's
 * blog post can still be a real coach.
 */
export function companyNameFrom(title: string | undefined, host: string): string {
  const t = (title ?? '').split('|')[0].split(' - ')[0].trim();
  // Deliberately stricter than looksLikeArticle, and deliberately NOT wired into the reject
  // decision. "Find an Online Fitness Coach" is the homepage title of a genuine solo coach
  // (coachclairefitness.com, 2026-08-04) — a bad name to greet her by, not a reason to drop her.
  const readsLikeASentence =
    /^(find|choose|hire|meet|discover|compare|get|start|join|book|learn|why|when|where|what|who|how)\b/i.test(t) ||
    t.split(/\s+/).length > 6;
  if (t && !looksLikeArticle(t) && !readsLikeASentence && t.length <= 60) return t;
  const bare = host.replace(/\.(com|net|org|co|io|fit|coach|us)$/i, '').replace(/[-_.]+/g, ' ').trim();
  return bare ? bare.replace(/\b\w/g, (c) => c.toUpperCase()) : host;
}

/**
 * True when a search result is a piece of coaching SOFTWARE / a SaaS platform / a management
 * tool sold TO coaches, rather than an individual coach's own coaching business.
 *
 * MEASURED 2026-08-05 (OUT-EMAIL-LANE-PRODUCT-FILTER, node 17): the email lane's positive gate
 * (`looksLikeOnlineCoach`) matches on phrases like "online coaching" and "coaching online" —
 * language a coaching-SaaS product's own marketing copy uses just as often as a real coach's
 * site does ("RackCoach is weight room management software for ... coaches"). The listicle
 * filter (`looksLikeArticle`) does not catch this shape either: it's not an article, it's a
 * product page. Same durable-signal reasoning as `looksLikeArticle`: a host blocklist can never
 * keep up with the next SaaS entrant, so this rejects by the SHAPE of product/SaaS marketing
 * copy — pricing, trials, "manage your clients" — instead of trying to name every tool.
 */
export function looksLikeCoachingProduct(text: string): boolean {
  const haystack = text.toLowerCase();
  const patterns: RegExp[] = [
    /\bsoftware\b/,
    /\bsaas\b/,
    /\b(management|scheduling|booking|billing|programming|workout[- ]building)\s+(software|platform|system|tool|app)\b/,
    /\b(app|platform|tool|system)\s+for\s+(coaches|trainers|gyms|studios|personal\s+trainers)\b/,
    /\bbuilt\s+for\s+(coaches|trainers|gyms|studios)\b/,
    /\bmanage\s+your\s+clients\b/,
    /\bclient\s+management\b/,
    /\bgym\s+management\b/,
    /\ball-in-one\s+(platform|solution)\b/,
    /\b(start|begin)\s+(a\s+)?free\s+trial\b/,
    /\bpricing\s+plans?\b/,
    /\bmonthly\s+subscription\b/,
    /\bapi\s+(access|integration)\b/,
  ];
  return patterns.some((p) => p.test(haystack));
}

/** True when the search result text reads like an online/virtual coach rather than a random account. */
export function looksLikeOnlineCoach(text: string): boolean {
  const haystack = text.toLowerCase();
  if (ONLINE_COACH_SIGNALS.some((s) => haystack.includes(s))) return true;
  return LINK_IN_BIO_HOSTS.some((h) => haystack.includes(h)) && /coach|trainer|training|fitness/.test(haystack);
}

// --- Email discovery (unchanged domain-trust logic — JB relies on this exact behaviour) ---

// No '%' in the local-part class: a leading url-encoded space ("%20info@...")
// was matching as part of the address before this was tightened.
const EMAIL_RE = /[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SKIP_EMAIL_DOMAINS = [
  'sentry.io', 'wixpress.com', 'example.com', 'godaddy.com', 'squarespace.com',
  'wordpress.com', 'schema.org', 'w3.org',
];
// Template/placeholder local-parts that show up in unfilled site boilerplate.
const SKIP_LOCAL_PARTS = ['user', 'email', 'name', 'yourname', 'youremail', 'test', 'example', 'placeholder'];
const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'me.com'];

/**
 * Only trust an email if it's on the business's own site domain, or on a
 * common personal provider (the pattern the good existing leads already use,
 * e.g. bigcrimson1992@hotmail.com). Third-party domains picked up from embed
 * widgets, ad pixels, or an unrelated site (a franchise's out-of-market
 * domain, a web-design credit link) are rejected rather than guessed at —
 * JB's screen shouldn't have to catch a bad address by hand.
 */
export async function findContactEmail(website: string | undefined): Promise<string | null> {
  if (!website) return null;
  const siteHost = hostnameOf(website);
  let candidates: string[];
  try {
    candidates = [website, new URL('/contact', website).toString(), new URL('/contact-us', website).toString()];
  } catch {
    return null;
  }
  const allFound: string[] = [];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      // Decode the one artifact seen in practice: a literal "%20" (url-encoded
      // space) sitting directly before an address, e.g. "mailto:%20info@..."
      // — left un-decoded it reads as part of the local part ("20info@...").
      const html = (await r.text()).replace(/%20/g, ' ');
      const matches = html.match(EMAIL_RE) || [];
      const clean = matches
        .map((m) => m.toLowerCase())
        .filter((m) => {
          const [local, domain] = m.split('@');
          if (!local || !domain) return false;
          if (SKIP_LOCAL_PARTS.includes(local)) return false;
          if (SKIP_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;
          if (m.endsWith('.png') || m.endsWith('.jpg') || m.endsWith('.gif')) return false;
          return true;
        });
      allFound.push(...clean);
    } catch {
      // best-effort; try next candidate
    }
  }
  if (!allFound.length) return null;

  const sameDomain = siteHost ? allFound.find((m) => m.split('@')[1] === siteHost || siteHost.endsWith(`.${m.split('@')[1]}`)) : undefined;
  if (sameDomain) return sameDomain;

  const personal = allFound.find((m) => PERSONAL_EMAIL_DOMAINS.includes(m.split('@')[1]));
  if (personal) return personal;

  return null; // third-party domain we can't vouch for — skip rather than guess
}

// --- Draft copy. No city, no invented people, no fake testimonials. ---

/**
 * Instagram DM. Deliberately DM-length: it has to read like a person typing in a message box,
 * not an email pasted into one. Keeps the two real hooks — free to list, and no fee on a client
 * the coach brought themselves.
 */
export function draftInstagramDm(handle: string): string {
  return (
    `Hey @${handle} — saw you coach clients online. I run Match Fit, a marketplace that matches ` +
    `people to online and virtual coaches anywhere in the US. Free to list, and you pay nothing ` +
    `on any client you bring yourself. Want me to set your profile up? match-fit.net`
  );
}

/** Email draft. Subject line stays (the Instagram lane has none). */
export function draftEmail(companyName: string): { subject: string; body: string } {
  const greeting = companyName ? `Hi ${companyName}` : 'Hi';
  return {
    subject: 'clients looking for an online coach',
    body:
      `${greeting} — found your site while looking for coaches who work with clients online.\n\n` +
      `I run Match Fit, a marketplace that matches people to online and virtual coaches anywhere ` +
      `in the US. I'm hand-matching everyone myself right now, so it isn't a lead blast — I'd be ` +
      `sending you people who fit how you actually coach.\n\n` +
      `Free to list, and zero fee on any client you bring yourself.\n\n` +
      `Reply and I'll build your profile: match-fit.net`,
  };
}

// --- Lane runners ---
//
// Writes go straight into Match Fit's own Prisma-modeled `OutreachInstagramLead` /
// `OutreachEmailLead` tables — the same tables and the same `today` lane an admin-triggered
// "Generate" batch lands in (see `outreach-ai.ts`), so every lead this finder drafts goes through
// the exact approve/reject/follow-up pipeline Outreach HQ already runs. `ventureId` is left
// unset: `matchFitLaneScope()` (outreach-venture-scope.ts) reads an unassigned row as Match Fit,
// which is correct — this finder only ever generates for Match Fit.

async function runInstagramLane(
  seen: Set<string>,
  now: Date,
  batchId: string,
  notified: OutreachAxonLeadRef[],
): Promise<LaneStats> {
  const stats = emptyLaneStats('instagram');
  const queries = pickQueries(INSTAGRAM_QUERIES, MAX_SEARCHES_PER_LANE, now);

  for (const query of queries) {
    if (stats.drafted >= LEADS_PER_LANE) break;
    let results: SerpOrganicResult[];
    try {
      results = await webSearch(query);
      stats.searches += 1;
    } catch (err) {
      console.error(`[lead-finder instagram] search failed for "${query}":`, err);
      continue;
    }

    for (const res of results) {
      if (stats.drafted >= LEADS_PER_LANE) break;
      if (!res.link) continue;
      const handle = instagramHandleFromResult(res);
      if (!handle) {
        stats.rejected += 1;
        continue;
      }
      stats.candidates += 1;

      const text = `${res.title ?? ''} ${res.snippet ?? ''} ${handle}`;
      if (!looksLikeOnlineCoach(text)) {
        stats.rejected += 1;
        continue;
      }

      // Dedupe on the normalized `@handle` — matches the format `getOutreachExclusionList`
      // and the rest of the Instagram lead pipeline already use.
      const normalizedHandle = normalizeInstagramHandle(handle);
      if (!normalizedHandle || seen.has(normalizedHandle)) {
        stats.duplicate += 1;
        continue;
      }
      seen.add(normalizedHandle); // provisional — stops a second hit in this same run inserting twice

      // When the result is a post rather than a profile, the title is the CAPTION ("I just
      // dropped a free live demo in my Stan Store so you can see ...") and makes a terrible
      // company name. Only keep a title that reads like a name; otherwise show the handle.
      const rawTitle = (res.title ?? '').split('(')[0].split('|')[0].trim();
      const titleIsName =
        rawTitle.length > 0 &&
        rawTitle.length <= 40 &&
        !/[.!?…]$/.test(rawTitle) &&
        // Some captions are just a link ("https://stan.store/CoachGymRat") — not a name.
        !/https?:\/\/|\bwww\.|\.(com|net|org|io|store|link)\b/i.test(rawTitle) &&
        !looksLikeArticle(rawTitle);
      const displayName = titleIsName ? rawTitle : `@${handle}`;
      const profileUrl = `https://www.instagram.com/${handle}/`;
      const dmText = draftInstagramDm(handle);

      let created: { id: string };
      try {
        created = await prisma.outreachInstagramLead.create({
          data: {
            handle: normalizedHandle,
            profileUrl,
            niche: 'Online coaching',
            targetGroup: 'VIRTUAL',
            whyMatchFit: 'Instagram bio describes online / remote coaching — takes clients anywhere, so a Match Fit fit.',
            likelihoodScore: 100,
            notes: `via:${INSTAGRAM_SOURCE} · company:${displayName}`,
            dmText,
            commentText: '',
            generationBatchId: batchId,
            outreachLane: 'today',
            queuedForDate: startOfEstDayUtc(now),
          },
          select: { id: true },
        });
      } catch (err) {
        console.error(`[lead-finder instagram] write failed for @${handle}:`, err);
        stats.rejected += 1;
        continue;
      }
      stats.inserted += 1;
      stats.drafted += 1;
      notified.push({ platform: 'instagram', leadId: created.id, handle: normalizedHandle, contact: profileUrl, dmText });
      console.log(`+ instagram @${handle}`);
    }
  }

  stats.shortfall = Math.max(0, LEADS_PER_LANE - stats.drafted);
  if (stats.shortfall > 0) {
    stats.note =
      `Only found ${stats.drafted} of ${LEADS_PER_LANE} Instagram coaches this run ` +
      `(${stats.candidates} profiles looked at, ${stats.rejected} not online coaches, ${stats.duplicate} already on the list).`;
    console.warn(`[lead-finder instagram] ${stats.note}`);
  }
  return stats;
}

async function runEmailLane(
  seen: Set<string>,
  now: Date,
  batchId: string,
  notified: OutreachAxonLeadRef[],
): Promise<LaneStats> {
  const stats = emptyLaneStats('email');
  const queries = pickQueries(EMAIL_QUERIES, MAX_SEARCHES_PER_LANE, now);
  const hostsTried = new Set<string>();

  for (const query of queries) {
    if (stats.drafted >= LEADS_PER_LANE) break;
    let results: SerpOrganicResult[];
    try {
      results = await webSearch(query);
      stats.searches += 1;
    } catch (err) {
      console.error(`[lead-finder email] search failed for "${query}":`, err);
      continue;
    }

    for (const res of results) {
      if (stats.drafted >= LEADS_PER_LANE) break;
      if (!res.link) continue;
      const host = hostnameOf(res.link);
      if (!host || isExcludedHost(host) || hostsTried.has(host)) {
        stats.rejected += 1;
        continue;
      }
      hostsTried.add(host);

      const text = `${res.title ?? ''} ${res.snippet ?? ''}`;
      if (!looksLikeOnlineCoach(text)) {
        stats.rejected += 1;
        continue;
      }
      // Publisher content that slipped past EXCLUDED_HOSTS. A listicle is not a coach, and the
      // email on it belongs to an editor. This is what put emily.phares@fortune.com in front of
      // JB on 2026-07-29.
      if (looksLikeArticle(res.title ?? '', res.link)) {
        stats.rejected += 1;
        continue;
      }
      // Coaching SOFTWARE that slipped past EXCLUDED_HOSTS and the article filter — a SaaS
      // product's own marketing copy uses the same "online coaching" language a real coach's
      // site does. See looksLikeCoachingProduct.
      if (looksLikeCoachingProduct(text)) {
        stats.rejected += 1;
        continue;
      }
      stats.candidates += 1;

      const website = `https://${host}`;
      const email = await findContactEmail(website);
      if (!email) {
        stats.noEmail += 1;
        continue;
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || seen.has(normalizedEmail)) {
        stats.duplicate += 1;
        continue;
      }
      seen.add(normalizedEmail);

      const company = companyNameFrom(res.title, host);
      const { subject, body } = draftEmail(company);

      let created: { id: string };
      try {
        created = await prisma.outreachEmailLead.create({
          data: {
            name: company,
            email: normalizedEmail,
            businessName: company,
            niche: 'Online coaching',
            emailSourceUrl: website,
            targetGroup: 'VIRTUAL',
            whyMatchFit: 'Independent online coaching business — contact address published on their own site.',
            likelihoodScore: 100,
            notes: `via:${EMAIL_SOURCE}`,
            emailSubject: subject,
            emailBody: body,
            generationBatchId: batchId,
            outreachLane: 'today',
            queuedForDate: startOfEstDayUtc(now),
          },
          select: { id: true },
        });
      } catch (err) {
        console.error(`[lead-finder email] write failed for ${normalizedEmail}:`, err);
        stats.rejected += 1;
        continue;
      }
      stats.inserted += 1;
      stats.drafted += 1;
      notified.push({ platform: 'email', leadId: created.id, handle: company, contact: normalizedEmail });
      console.log(`+ email ${company} -> ${normalizedEmail}`);
    }
  }

  stats.shortfall = Math.max(0, LEADS_PER_LANE - stats.drafted);
  if (stats.shortfall > 0) {
    stats.note =
      `Only found ${stats.drafted} of ${LEADS_PER_LANE} email leads this run ` +
      `(${stats.candidates} sites looked at, ${stats.noEmail} had no address we could trust, ${stats.duplicate} already on the list).`;
    console.warn(`[lead-finder email] ${stats.note}`);
  }
  return stats;
}

/**
 * Runs both lanes. Each lane is isolated: a lane that throws is reported with a note and does
 * NOT stop the other lane from inserting, and a short lane inserts what it found rather than
 * padding with junk or failing the run.
 *
 * Dedupe seeds off `getOutreachExclusionList` (Match Fit's own Prisma tables — active leads plus
 * already-registered Fitness Pros), the same helper the admin "Generate" route already uses, so
 * this finder and a manual admin batch never pitch the same handle/email twice.
 */
export async function runOutreachNationwideFinder(now = new Date()): Promise<FinderRunSummary> {
  // Same self-heal call the admin "Generate" route makes before touching these tables — repairs
  // missing columns/tables rather than failing the whole cron on a schema drift.
  await ensureOutreachHubSchema();

  const batchId = `nationwide_${now.getTime()}`;

  const [instagramSeen, emailSeen] = await Promise.all([
    getOutreachExclusionList('instagram'),
    getOutreachExclusionList('email'),
  ]);

  const lanes: LaneStats[] = [];
  const notified: OutreachAxonLeadRef[] = [];

  try {
    lanes.push(await runInstagramLane(new Set(instagramSeen), now, batchId, notified));
  } catch (err) {
    const failed = emptyLaneStats('instagram');
    failed.shortfall = LEADS_PER_LANE;
    failed.note = `The instagram lane could not run this time: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[lead-finder instagram] lane failed:', err);
    lanes.push(failed);
  }

  try {
    lanes.push(await runEmailLane(new Set(emailSeen), now, batchId, notified));
  } catch (err) {
    const failed = emptyLaneStats('email');
    failed.shortfall = LEADS_PER_LANE;
    failed.note = `The email lane could not run this time: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[lead-finder email] lane failed:', err);
    lanes.push(failed);
  }

  // Fire-and-forget AXON/Telegram notification, same "new_leads" contract the admin generate
  // route uses — a no-op when AXON_OUTREACH_EVENT_WEBHOOK_URL is unset, never fails the run.
  if (notified.length > 0) {
    await fireOutreachAxonEvent({ eventType: 'new_leads', leads: notified, meta: { source: 'nationwide_finder' } }).catch(
      (err) => console.error('[lead-finder] AXON notify failed (non-fatal):', err),
    );
  }

  const summary: FinderRunSummary = {
    target: LEADS_PER_LANE,
    lanes,
    inserted: lanes.reduce((n, l) => n + l.inserted, 0),
    drafted: lanes.reduce((n, l) => n + l.drafted, 0),
    shortfall: lanes.reduce((n, l) => n + l.shortfall, 0),
  };
  return summary;
}
