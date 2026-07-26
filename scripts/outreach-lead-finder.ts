/**
 * OUT-LEAD-FINDER
 *
 * Finds new Match Fit trainer/studio leads inside the ONE launch polygon
 * (Midtown / West Midtown / Old Fourth Ward / Inman Park — the polygon the
 * Atlanta Coach Acquisition Playbook recommends and every prior session has
 * used; MF-POLYGON-PICK is still awaiting JB's final sign-off, so this stays
 * a draft-only queue either way — nothing here sends anything), drafts one
 * templated message per lead, and leaves both rows exactly where JB's Monday
 * screen expects them:
 *
 *   insert outreach_leads  (status='new')
 *     -> insert outreach_messages (status='draft')
 *       -> update outreach_leads (status='drafted')
 *
 * Never touches automation_controls, never approves/sends anything, never
 * calls a paid LLM (Google Maps via SerpApi + plain-text template fill only —
 * the paid-API executor is permanently disabled per NI-Brain Learnings
 * 2026-07-25, so this must not depend on one).
 *
 * Run: NI_BRAIN_SUPABASE_URL=... NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY=... SERPAPI_API_KEY=... \
 *      npx tsx scripts/outreach-lead-finder.ts
 * (All three secrets already live in this repo's own `platform_secrets` table
 * under those exact key names — wire a bootstrap step to export them before
 * running this in CI/cron, same pattern as the other admin bootstrap routes.)
 */

type SerpMapsResult = {
  title?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  place_id?: string;
};

type Neighborhood = { label: string; ll: string; query: string };

const NEIGHBORHOODS: Neighborhood[] = [
  { label: 'Midtown', ll: '@33.7838,-84.3866,14z', query: 'personal trainer Midtown Atlanta' },
  { label: 'West Midtown', ll: '@33.7877,-84.4152,14z', query: 'personal trainer West Midtown Atlanta' },
  { label: 'Old Fourth Ward', ll: '@33.7627,-84.3663,14z', query: 'personal trainer Old Fourth Ward Atlanta' },
  { label: 'Inman Park', ll: '@33.7573,-84.3516,14z', query: 'personal trainer Inman Park Atlanta' },
];

const MAX_RESULTS_PER_NEIGHBORHOOD = 10;
const VENTURE = 'match_fit';
const SOURCE = 'google_maps_polygon';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function supabase() {
  const url = env('NI_BRAIN_SUPABASE_URL');
  const key = env('NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  async function select<T = Record<string, unknown>>(table: string, filter: string): Promise<T[]> {
    const r = await fetch(`${url}/rest/v1/${table}?${filter}`, { headers: { ...headers, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`select ${table}: HTTP ${r.status} ${await r.text()}`);
    return r.json();
  }
  async function insert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T | { conflict: true }> {
    const r = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (r.status === 409) return { conflict: true };
    if (!r.ok) {
      const text = await r.text();
      // 23505 = unique_violation (dedupe_key collision) — treat as a normal skip, not a fatal error.
      if (r.status === 400 && /23505|duplicate key/i.test(text)) return { conflict: true };
      throw new Error(`insert ${table}: HTTP ${r.status} ${text}`);
    }
    const data = await r.json();
    return Array.isArray(data) ? data[0] : data;
  }
  async function patch(table: string, filter: string, row: Record<string, unknown>): Promise<void> {
    const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`patch ${table}: HTTP ${r.status} ${await r.text()}`);
  }
  return { select, insert, patch };
}

async function searchNeighborhood(n: Neighborhood): Promise<SerpMapsResult[]> {
  const apiKey = env('SERPAPI_API_KEY');
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: n.query,
    ll: n.ll,
    type: 'search',
    hl: 'en',
    gl: 'us',
    api_key: apiKey,
  });
  const r = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!r.ok) throw new Error(`SerpApi HTTP ${r.status} for "${n.query}"`);
  const data = await r.json();
  const results: SerpMapsResult[] = data.local_results || [];
  return results.slice(0, MAX_RESULTS_PER_NEIGHBORHOOD);
}

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

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Only trust an email if it's on the business's own site domain, or on a
 * common personal provider (the pattern the good existing leads already use,
 * e.g. bigcrimson1992@hotmail.com). Third-party domains picked up from embed
 * widgets, ad pixels, or an unrelated site (a franchise's out-of-market
 * domain, a web-design credit link) are rejected rather than guessed at —
 * JB's Monday screen shouldn't have to catch a bad address by hand.
 */
async function findContactEmail(website: string | undefined): Promise<string | null> {
  if (!website) return null;
  const siteHost = hostnameOf(website);
  const candidates = [website, new URL('/contact', website).toString(), new URL('/contact-us', website).toString()];
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

function draftMessage(companyName: string, niche: string): { subject: string; body: string } {
  return {
    subject: `couple of Atlanta clients looking in ${niche}`,
    body:
      `Hi ${companyName} — found you on Google Maps in ${niche}, so you're right where I'm looking.\n\n` +
      `I run Match Fit, an Atlanta-only marketplace that matches clients to independent trainers. I'm hand-matching everyone myself right now, so it isn't a lead blast — I'd be sending you people who fit how you actually train.\n\n` +
      `Free to list, and zero fee on any client you bring yourself.\n\n` +
      `Reply and I'll build your profile: match-fit.net`,
  };
}

async function main() {
  const db = supabase();

  const existing = await db.select<{ dedupe_key: string }>(
    'outreach_leads',
    `venture=eq.${VENTURE}&select=dedupe_key`,
  );
  const seen = new Set(existing.map((r) => r.dedupe_key));

  const stats = { searched: 0, candidates: 0, noWebsite: 0, noEmail: 0, duplicate: 0, inserted: 0, drafted: 0 };

  for (const n of NEIGHBORHOODS) {
    let results: SerpMapsResult[] = [];
    try {
      results = await searchNeighborhood(n);
    } catch (err) {
      console.error(`SerpApi search failed for ${n.label}:`, err);
      continue;
    }
    stats.searched += results.length;

    for (const res of results) {
      const company = (res.title || '').trim();
      if (!company) continue;
      stats.candidates++;

      if (!res.website) {
        stats.noWebsite++;
        continue;
      }

      const email = await findContactEmail(res.website);
      if (!email) {
        stats.noEmail++;
        continue;
      }

      const dedupeKey = `${VENTURE}|${email}`;
      if (seen.has(dedupeKey)) {
        stats.duplicate++;
        continue;
      }
      seen.add(dedupeKey); // provisional, prevents a second hit this same run inserting the same email twice

      const ratingBits =
        typeof res.rating === 'number' && typeof res.reviews === 'number'
          ? ` — ${res.rating}★ (${res.reviews} reviews)`
          : '';

      const leadRow = {
        venture: VENTURE,
        channel: 'email',
        full_name: null,
        email,
        company,
        city: 'Atlanta',
        niche: n.label,
        profile_url: res.website,
        source: SOURCE,
        source_ref: res.place_id || null,
        why: `Independent trainer/studio in the ${n.label} launch polygon${ratingBits}.`,
        score: 100,
        status: 'new',
        // dedupe_key is a GENERATED column (venture || '|' || lower(email)) — do not set it directly.
      };

      const lead = await db.insert<{ id: string }>('outreach_leads', leadRow);
      if ('conflict' in lead) {
        stats.duplicate++;
        continue;
      }
      stats.inserted++;
      const leadId = (lead as { id: string }).id;

      const { subject, body } = draftMessage(company, n.label);
      await db.insert('outreach_messages', {
        lead_id: leadId,
        channel: 'email',
        subject,
        body,
        step: 1,
        status: 'draft',
      });

      await db.patch('outreach_leads', `id=eq.${leadId}`, { status: 'drafted' });
      stats.drafted++;
      console.log(`+ ${company} (${n.label}) -> ${email}`);
    }
  }

  console.log('OUT-LEAD-FINDER run complete:', JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error('OUT-LEAD-FINDER failed:', err);
  process.exit(1);
});
