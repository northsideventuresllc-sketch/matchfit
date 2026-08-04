/**
 * Manual runner for the Match Fit outreach lead finder (online / virtual coaches, NATIONWIDE).
 *
 * All of the logic lives in `src/lib/outreach-nationwide-finder.ts` so the weekday cron route
 * (`/api/cron/outreach-lead-finder`) and this script run exactly the same code. There is no city,
 * lat/long or polygon anywhere in it — Match Fit recruits online coaches across the whole country.
 *
 * Run: NI_BRAIN_SUPABASE_URL=... NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY=... SERPAPI_API_KEY=... \
 *      npx tsx scripts/outreach-lead-finder.ts
 * (All three secrets live in this repo's `platform_secrets` table under those exact key names.)
 */

import { runOutreachNationwideFinder } from '../src/lib/outreach-nationwide-finder';

runOutreachNationwideFinder()
  .then((summary) => {
    console.log('Outreach lead finder run complete:', JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error('Outreach lead finder failed:', err);
    process.exit(1);
  });
