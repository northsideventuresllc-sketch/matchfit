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

function mapFeaturedAllocationRows(
  allocations: Array<{
    source: string;
    trainer: {
      username: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
      fitnessNiches: string | null;
      bio: string | null;
      profileImageUrl: string | null;
    };
  }>,
): FeaturedTrainerCard[] {
  return allocations.map((a) => ({
    username: a.trainer.username,
    displayName: coachDisplayName(a.trainer),
    specialtyLine: specialtyLine(a.trainer),
    profileImageUrl: a.trainer.profileImageUrl,
    source: a.source as "PAID_BID" | "RAFFLE",
  }));
}

const featuredTrainerSelect = {
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
} as const;

export async function getFeaturedTrainersForHomepage(opts: {
  /** Client profile ZIP or marketing `?zip=` (US). */
  zipInput?: string | null;
  /** Virtual/DIY-only clients: show featured coaches nationwide, not just their ZIP prefix pool. */
  nationwide?: boolean;
}): Promise<FeaturedTrainerCard[]> {
  const displayDay = homepageDisplayDayKey();

  if (opts.nationwide) {
    const allocations = await prisma.featuredDailyAllocation.findMany({
      where: { displayDayKey: displayDay },
      orderBy: [{ source: "asc" }, { sortOrder: "asc" }],
      take: 40,
      select: featuredTrainerSelect,
    });
    const seen = new Set<string>();
    const deduped = allocations.filter((a) => {
      if (seen.has(a.trainer.username)) return false;
      seen.add(a.trainer.username);
      return true;
    });
    return mapFeaturedAllocationRows(deduped.slice(0, 8));
  }

  const prefix = clientZipToPrefix(opts.zipInput ?? null);
  if (!prefix) return [];

  await ensureFeaturedAllocationsResolved(prefix, displayDay);

  const allocations = await prisma.featuredDailyAllocation.findMany({
    where: { regionZipPrefix: prefix, displayDayKey: displayDay },
    orderBy: { sortOrder: "asc" },
    select: featuredTrainerSelect,
  });

  return mapFeaturedAllocationRows(allocations);
}
