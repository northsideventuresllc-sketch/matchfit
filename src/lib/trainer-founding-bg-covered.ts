import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { launchTrainerAccountWhere } from "@/lib/launch-account-counts";
import { getTrainerFoundingBgCoveredMax } from "@/lib/match-fit-launch-promotion-caps";

/** Known founding coach in the first-10 BG-covered cohort (explicit allowlist). */
export const KRISTIAN_FOUNDING_BG_COVERED_MATCH: Prisma.TrainerWhereInput = {
  OR: [
    { firstName: { equals: "Kristian", mode: "insensitive" } },
    { username: { contains: "kristian", mode: "insensitive" } },
    { email: { contains: "kristian", mode: "insensitive" } },
  ],
};

export function isKristianFoundingBgCoveredTrainer(args: {
  firstName?: string | null;
  username?: string | null;
  email?: string | null;
}): boolean {
  const first = (args.firstName ?? "").trim().toLowerCase();
  const user = (args.username ?? "").trim().toLowerCase();
  const email = (args.email ?? "").trim().toLowerCase();
  return first === "kristian" || user.includes("kristian") || email.includes("kristian");
}

/** Upgrade legacy founding rows and explicit cohort members to FOUNDING_BG_COVERED. */
export async function syncFoundingBgCoveredTrainerPricingModes(): Promise<{
  updatedByRank: number;
  updatedKristian: number;
}> {
  const cap = getTrainerFoundingBgCoveredMax();
  const ranked = await prisma.trainer.findMany({
    where: launchTrainerAccountWhere(),
    orderBy: { createdAt: "asc" },
    take: cap,
    select: { id: true },
  });
  const rankedIds = ranked.map((t) => t.id);

  const [byRank, kristian] = await Promise.all([
    rankedIds.length
      ? prisma.trainerProfile.updateMany({
          where: {
            trainerId: { in: rankedIds },
            registrationFeePricingMode: {
              in: ["FOUNDING_BG_SURCHARGE_20PCT", "FOUNDING_BG_COVERED"],
            },
          },
          data: {
            registrationFeePricingMode: "FOUNDING_BG_COVERED",
            registrationFeeWaived: true,
          },
        })
      : Promise.resolve({ count: 0 }),
    prisma.trainerProfile.updateMany({
      where: {
        trainer: KRISTIAN_FOUNDING_BG_COVERED_MATCH,
      },
      data: {
        registrationFeePricingMode: "FOUNDING_BG_COVERED",
        registrationFeeWaived: true,
      },
    }),
  ]);

  return { updatedByRank: byRank.count, updatedKristian: kristian.count };
}

export type FoundingBgCoveredEmailContent = {
  subject: string;
  text: string;
  html: string;
};

/** Draft email for founding coaches with platform-covered background screening. */
export function buildFoundingBgCoveredTrainerEmail(args: {
  firstName: string;
  onboardingUrl?: string;
  requestInviteUrl?: string;
}): FoundingBgCoveredEmailContent {
  const name = args.firstName.trim() || "Coach";
  const onboardingUrl = args.onboardingUrl ?? "https://match-fit.net/trainer/onboarding";
  const requestInviteUrl =
    args.requestInviteUrl ?? "https://match-fit.net/trainer/onboarding/background-check/request-invite";

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
