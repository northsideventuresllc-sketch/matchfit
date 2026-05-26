/**
 * Verifies Stripe env vars without printing secrets.
 * Usage: node --env-file=.env scripts/verify-stripe-env.mjs
 */
import Stripe from "stripe";

function mask(key) {
  if (!key || key.length < 12) return "(missing)";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

const secret = process.env.STRIPE_SECRET_KEY?.trim();
const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const bgUsd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD?.trim();

const errors = [];
if (!secret) errors.push("STRIPE_SECRET_KEY is missing");
if (!publishable) errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing");
if (!webhook) errors.push("STRIPE_WEBHOOK_SECRET is missing");
if (!bgUsd) errors.push("NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD is missing");

if (secret && !secret.startsWith("sk_")) errors.push("STRIPE_SECRET_KEY should start with sk_");
if (publishable && !publishable.startsWith("pk_")) errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_");
if (webhook && !webhook.startsWith("whsec_")) errors.push("STRIPE_WEBHOOK_SECRET should start with whsec_");

if (errors.length) {
  console.error("Stripe env check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const stripe = new Stripe(secret, { typescript: true });
const account = await stripe.accounts.retrieve();
const mode = secret.includes("_live_") ? "live" : "test";

console.log("Stripe env OK");
console.log(`  secret:      ${mask(secret)} (${mode})`);
console.log(`  publishable: ${mask(publishable)} (${publishable.includes("_live_") ? "live" : "test"})`);
console.log(`  webhook:     ${mask(webhook)}`);
console.log(`  bg fee USD:  ${bgUsd}`);
console.log(`  account id:  ${account.id}`);

if (secret.includes("_live_") !== publishable.includes("_live_")) {
  console.error("Mismatch: secret and publishable key must both be live or both be test.");
  process.exit(1);
}
