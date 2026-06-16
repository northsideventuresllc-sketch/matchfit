#!/usr/bin/env node
/**
 * Sends the founding BG-covered email to Kristian (or --dry-run to preview).
 * Requires RESEND_API_KEY and DATABASE_URL in env (.env).
 *
 * Usage:
 *   node --env-file=.env scripts/send-kristian-founding-bg-covered-email.mjs --dry-run
 *   node --env-file=.env scripts/send-kristian-founding-bg-covered-email.mjs --send
 *   KRISTIAN_EMAIL=coach@example.com node --env-file=.env ... --send
 */
import pg from "pg";

const FROM = "Match Fit <noreply@match-fit.net>";
const BCC = ["support@match-fit.net", "jb@match-fit.net"];

function buildEmail(firstName) {
  const name = (firstName ?? "").trim() || "Coach";
  const onboardingUrl = "https://match-fit.net/trainer/onboarding";
  const requestInviteUrl =
    "https://match-fit.net/trainer/onboarding/background-check/request-invite";

  const subject = "Your Match Fit background check is covered — next steps";

  const text = [
    `Hi ${name},`,
    "",
    "Great news: you are in Match Fit's first 10 founding coaches. Match Fit is covering your Checkr background screening fee.",
    "",
    "What you need to do:",
    "",
    `Sign in to your trainer onboarding dashboard: ${onboardingUrl}`,
    "Upload any outstanding certification documents (if you have not already).",
    `Request your Checkr screening invitation: ${requestInviteUrl}`,
    "Complete Checkr when the invitation email arrives (check spam/promotions folders).",
    "",
    "After screening clears and your credentials are approved, Match Fit captures only the small founding platform onboarding slice you authorized at signup.",
    "",
    "Questions? Email support@match-fit.net.",
    "",
    "Match Fit Team",
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#111;">
<p>Hi ${name},</p>
<p><strong>Great news:</strong> you are in Match Fit's first 10 founding coaches. <strong>Match Fit is covering your Checkr background screening fee.</strong></p>
<p><strong>What you need to do:</strong></p>
<ul>
<li><a href="${onboardingUrl}">Sign in to your trainer onboarding dashboard</a></li>
<li>Upload any outstanding certification documents (if you have not already).</li>
<li><a href="${requestInviteUrl}">Request your Checkr screening invitation</a></li>
<li>Complete Checkr when the invitation email arrives (check spam/promotions folders).</li>
</ul>
<p>After screening clears and your credentials are approved, Match Fit captures only the small founding platform onboarding slice you authorized at signup.</p>
<p>Questions? Email <a href="mailto:support@match-fit.net">support@match-fit.net</a>.</p>
<p>Match Fit Team</p>
</body></html>`;

  return { subject, text, html };
}

async function findKristian(client) {
  const { rows } = await client.query(
    `SELECT id, "firstName", email, username
     FROM trainers
     WHERE LOWER("firstName") = 'kristian'
        OR LOWER(username) LIKE '%kristian%'
        OR LOWER(email) LIKE '%kristian%'
     ORDER BY "createdAt" ASC
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

async function main() {
  const send = process.argv.includes("--send");
  const dryRun = process.argv.includes("--dry-run") || !send;

  const overrideEmail = process.env.KRISTIAN_EMAIL?.trim();
  const overrideFirstName = process.env.KRISTIAN_FIRST_NAME?.trim() || "Kristian";

  const databaseUrl =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

  let trainerEmail = overrideEmail;
  let trainerFirstName = overrideFirstName;

  if (!trainerEmail) {
    if (!databaseUrl) {
      console.error("DATABASE_URL or DIRECT_URL is required (or set KRISTIAN_EMAIL).");
      process.exit(1);
    }

    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      const trainer = await findKristian(pool);
      if (!trainer) {
        console.error("No trainer row matched Kristian.");
        process.exit(1);
      }
      trainerEmail = trainer.email;
      trainerFirstName = trainer.firstName ?? overrideFirstName;
    } finally {
      await pool.end();
    }
  }

  const draft = buildEmail(trainerFirstName);
  console.log("\n--- EMAIL DRAFT ---");
  console.log("To:", trainerEmail);
  console.log("From:", FROM);
  console.log("Bcc:", BCC.join(", "));
  console.log("Subject:", draft.subject);
  console.log("\n-- TEXT --\n");
  console.log(draft.text);

  if (dryRun) {
    console.log("\nDry run only — pass --send to deliver via Resend.");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("RESEND_API_KEY is required for --send.");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [trainerEmail],
      bcc: BCC,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error("Resend error:", body);
    process.exit(1);
  }
  console.log("\nSent:", body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
