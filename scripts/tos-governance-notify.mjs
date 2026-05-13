/**
 * GitHub Actions helper: email jb@match-fit.net when the ToS governance workflow runs.
 * Requires RESEND_API_KEY in repository secrets (skipped if unset).
 */

const RESEND_ONBOARDING_FROM = "onboarding@resend.dev";
const DEFAULT_TO = "jb@match-fit.net";

const key = process.env.RESEND_API_KEY?.trim();
const to = (process.env.TOS_NOTIFY_EMAIL || DEFAULT_TO).trim();
const alignment = process.env.ALIGNMENT_JOB_RESULT || "unknown";
const event = process.env.GITHUB_EVENT_NAME || "unknown";
const server = process.env.GITHUB_SERVER_URL || "";
const repo = process.env.GITHUB_REPOSITORY || "";
const runId = process.env.GITHUB_RUN_ID || "";

let body = `Match Fit Terms / governance workflow\n\n`;
body += `Event: ${event}\n`;
body += `Alignment job result: ${alignment}\n`;
if (server && repo && runId) {
  body += `Run log: ${server}/${repo}/actions/runs/${runId}\n`;
}
body += `\nWeekly schedule plus pushes touching Terms-related paths trigger this notice.\n`;

if (!key) {
  console.log("tos-governance-notify: RESEND_API_KEY not set — skipping email");
  process.exit(0);
}

const subject = `Match Fit ToS pipeline (${event}) — ${alignment}`;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: RESEND_ONBOARDING_FROM,
    to,
    subject,
    text: body,
  }),
});

const raw = await res.text();
if (!res.ok) {
  console.error(`Resend HTTP ${res.status}: ${raw}`);
  process.exit(1);
}
console.log("tos-governance-notify: email sent");
