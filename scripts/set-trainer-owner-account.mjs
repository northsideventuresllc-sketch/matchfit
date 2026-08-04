#!/usr/bin/env node
/**
 * Marks a Fitness Pro account as an owner/staff account.
 *
 *   node --env-file=.env scripts/set-trainer-owner-account.mjs coachjonny22
 *   node --env-file=.env scripts/set-trainer-owner-account.mjs coachjonny22 --list   # undo hiding
 *
 * What it sets:
 *   - hidden from public discovery, FitHub feeds and public profile pages (still fully usable
 *     when signed in, and still counted in launch totals)
 *   - exempt from the platform subscription lifecycle: no trial expiry, no payment grace,
 *     no deactivation, no billing lock
 *   - Elite Fitness Pro tier
 *   - good standing: clears deactivation, payment grace and safety suspension
 *   - dashboard unlocked, so certifications and the background check can be done from there
 *
 * Idempotent — safe to run repeatedly. Prints the before/after of every field it touches.
 */

import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const username = args.find((a) => !a.startsWith("--"));
const relist = args.includes("--list");

if (!username) {
  console.error("Usage: node --env-file=.env scripts/set-trainer-owner-account.mjs <username> [--list]");
  process.exit(1);
}

function diff(label, before, after) {
  const b = before instanceof Date ? before.toISOString() : String(before);
  const a = after instanceof Date ? after.toISOString() : String(after);
  return b === a ? `  = ${label}: ${a}` : `  → ${label}: ${b} => ${a}`;
}

async function main() {
  const trainer = await prisma.trainer.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      email: true,
      safetySuspended: true,
      accountDeactivatedAt: true,
      paymentGraceUntil: true,
      platformTrialConsumed: true,
      hiddenFromPublicMarketplace: true,
      platformBillingExempt: true,
      profile: { select: { accountTier: true, hasSignedTOS: true, limitedDashboardUnlockedAt: true } },
    },
  });

  if (!trainer) {
    console.error(`No Fitness Pro found with username "${username}".`);
    process.exit(1);
  }

  const now = new Date();
  const hide = !relist;

  await prisma.trainer.update({
    where: { id: trainer.id },
    data: {
      hiddenFromPublicMarketplace: hide,
      platformBillingExempt: true,
      accountDeactivatedAt: null,
      paymentGraceUntil: null,
      platformTrialConsumed: false,
      safetySuspended: false,
    },
  });

  await prisma.trainerProfile.upsert({
    where: { trainerId: trainer.id },
    create: {
      trainerId: trainer.id,
      accountTier: "elite_fitness_pro",
      hasSignedTOS: true,
      limitedDashboardUnlockedAt: now,
    },
    update: {
      accountTier: "elite_fitness_pro",
      hasSignedTOS: true,
      limitedDashboardUnlockedAt: trainer.profile?.limitedDashboardUnlockedAt ?? now,
    },
  });

  console.log(`Fitness Pro @${trainer.username} (${trainer.email})`);
  console.log(diff("hidden from public", trainer.hiddenFromPublicMarketplace, hide));
  console.log(diff("billing exempt", trainer.platformBillingExempt, true));
  console.log(diff("account tier", trainer.profile?.accountTier ?? "none", "elite_fitness_pro"));
  console.log(diff("deactivated at", trainer.accountDeactivatedAt ?? "null", "null"));
  console.log(diff("payment grace until", trainer.paymentGraceUntil ?? "null", "null"));
  console.log(diff("safety suspended", trainer.safetySuspended, false));
  console.log(diff("agreement signed", trainer.profile?.hasSignedTOS ?? false, true));
  console.log(
    diff("dashboard unlocked", trainer.profile?.limitedDashboardUnlockedAt ?? "null", trainer.profile?.limitedDashboardUnlockedAt ?? now),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
