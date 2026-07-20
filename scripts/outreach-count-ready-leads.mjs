#!/usr/bin/env node
/**
 * Count Outreach HQ ready Join-as-FP / Both leads (REV-FIRST / MF-REV-REFILL).
 * Usage: node --env-file=.env scripts/outreach-count-ready-leads.mjs
 * Prints counts only — never dumps lead PII to stdout.
 */
import pg from "pg";

const TARGET = 15;

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL or DIRECT_URL.");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows } = await client.query(`
      SELECT
        (SELECT count(*)::int FROM outreach_instagram_leads
          WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL AND status = 'LEAD'
            AND "savedToHubAt" IS NOT NULL
            AND "outreachIntent" IN ('JOIN_AS_FP', 'BOTH')
            AND coalesce(nullif(trim("dmText"), ''), '') <> '') AS instagram_ready,
        (SELECT count(*)::int FROM outreach_email_leads
          WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL AND status = 'LEAD'
            AND "savedToHubAt" IS NOT NULL
            AND "outreachIntent" IN ('JOIN_AS_FP', 'BOTH')
            AND coalesce(nullif(trim("emailSubject"), ''), '') <> ''
            AND coalesce(nullif(trim("emailBody"), ''), '') <> '') AS email_ready
    `);
    const instagram = rows[0]?.instagram_ready ?? 0;
    const email = rows[0]?.email_ready ?? 0;
    const total = instagram + email;
    const payload = {
      instagram,
      email,
      total,
      target: TARGET,
      meetsTarget: total >= TARGET,
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = payload.meetsTarget ? 0 : 2;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
