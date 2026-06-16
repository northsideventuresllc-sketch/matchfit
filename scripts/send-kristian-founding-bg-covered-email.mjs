#!/usr/bin/env node
/**
 * Sends the founding BG-covered email to Kristian (or --dry-run to preview).
 * Requires RESEND_API_KEY and DATABASE_URL in env (.env).
 *
 * Usage:
 *   node --env-file=.env scripts/send-kristian-founding-bg-covered-email.mjs --dry-run
 *   node --env-file=.env scripts/send-kristian-founding-bg-covered-email.mjs --send
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  buildFoundingBgCoveredTrainerEmail,
  isKristianFoundingBgCoveredTrainer,
  syncFoundingBgCoveredTrainerPricingModes,
} from "../src/lib/trainer-founding-bg-covered.ts";

const FROM = "Match Fit <noreply@match-fit.net>";

async function main() {
  const send = process.argv.includes("--send");
  const dryRun = process.argv.includes("--dry-run") || !send;

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const sync = await syncFoundingBgCoveredTrainerPricingModes();
    console.log("Pricing sync:", sync);

    const trainer = await prisma.trainer.findFirst({
      where: {
        OR: [
          { firstName: { equals: "Kristian", mode: "insensitive" } },
          { username: { contains: "kristian", mode: "insensitive" } },
          { email: { contains: "kristian", mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, email: true, username: true },
    });

    if (!trainer) {
      console.error("No trainer row matched Kristian.");
      process.exit(1);
    }

    if (!isKristianFoundingBgCoveredTrainer(trainer)) {
      console.error("Matched trainer failed Kristian cohort check.");
      process.exit(1);
    }

    const draft = buildFoundingBgCoveredTrainerEmail({ firstName: trainer.firstName });
    console.log("\n--- EMAIL DRAFT ---");
    console.log("To:", trainer.email);
    console.log("From:", FROM);
    console.log("Subject:", draft.subject);
    console.log("\n-- TEXT --\n");
    console.log(draft.text);
    console.log("\n-- HTML --\n");
    console.log(draft.html);

    if (dryRun) {
      console.log("\nDry run only — pass --send after owner approval to deliver via Resend.");
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
        to: [trainer.email],
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
