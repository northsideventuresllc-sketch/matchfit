import { prisma } from "@/lib/prisma";
import { ensureFeaturedAllocationsResolved } from "@/lib/featured-competition";
import { homepageDisplayDayKey } from "@/lib/featured-eastern-calendar";
import { clientZipToPrefix } from "@/lib/featured-region";

export type FeaturedTrainerCard = {
  username: string;
  displayName: string;
  specialtyLine: string;
  profileImageUrl: string | null;
  source: "PAID_BID" | "RAFFLE";
};

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

function specialtyLine(trainer: { fitnessNiches: string | null; bio: string | null }): string {
  const n = trainer.fitnessNiches?.trim();
  if (n) return n.length > 80 ? `${n.slice(0, 77)}…` : n;
  const b = trainer.bio?.trim();
  if (b) return b.length > 80 ? `${b.slice(0, 77)}…` : b;
  return "Personal training";
}

export async function getFeaturedTrainersForHomepage(opts: {
  /** Client profile ZIP or marketing `?zip=` (US). */
  zipInput?: string | null;
}): Promise<FeaturedTrainerCard[]> {
  const prefix = clientZipToPrefix(opts.zipInput ?? null);
  if (!prefix) return [];

  const displayDay = homepageDisplayDayKey();
  await ensureFeaturedAllocationsResolved(prefix, displayDay);

  const allocations = await prisma.featuredDailyAllocation.findMany({
    where: { regionZipPrefix: prefix, displayDayKey: displayDay },
    orderBy: { sortOrder: "asc" },
    select: {
      source: true,
      trainer: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          fitnessNiches: true,
          bio: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return allocations.map((a) => ({
    username: a.trainer.username,
    displayName: coachDisplayName(a.trainer),
    specialtyLine: specialtyLine(a.trainer),
    profileImageUrl: a.trainer.profileImageUrl,
    source: a.source as "PAID_BID" | "RAFFLE",
  }));
}
