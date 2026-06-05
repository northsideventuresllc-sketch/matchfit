#!/usr/bin/env node
/**
 * Send a probe OTP email through Resend (validates 2FA delivery path).
 *
 * Usage:
 *   RESEND_API_KEY=re_... node scripts/send-otp-probe-email.mjs jb@example.com
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const to = process.argv[2]?.trim();
if (!to || !to.includes("@")) {
  console.error("Usage: node scripts/send-otp-probe-email.mjs recipient@example.com");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const secretsPath = resolve(root, ".beta-launch-secrets.local");
if (existsSync(secretsPath)) {
  for (const line of readFileSync(secretsPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = line.slice(eq + 1).trim();
  }
}

const key = process.env.RESEND_API_KEY?.trim();
if (!key) {
  console.error("RESEND_API_KEY is required.");
  process.exit(1);
}

const from = process.env.RESEND_FROM_EMAIL?.trim() || process.env.MATCH_FIT_DEFAULT_FROM?.trim();
if (!from) {
  console.error("Set RESEND_FROM_EMAIL or MATCH_FIT_DEFAULT_FROM for the probe From header.");
  process.exit(1);
}
const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: `[Match Fit probe] Your verification code: ${code}`,
    text: `Match Fit email delivery probe.\n\nTest code: ${code}\n\nIf you received this, login 2FA emails are working.`,
  }),
});

const raw = await res.text();
if (!res.ok) {
  console.error(`Resend HTTP ${res.status}: ${raw}`);
  process.exit(1);
}

console.log(`Probe OTP email sent to ${to}`);
console.log(raw);
