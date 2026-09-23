import { getAppOrigin } from "@/lib/app-origin";
import { getRequestClientIp } from "@/lib/request-client-ip";
import { simpleRateLimitAllow } from "@/lib/simple-rate-limit";
import { publicMarketplaceVisibleTrainerWhere } from "@/lib/match-fit-public-marketplace-hidden";
import {
  clientDiscoveryVisibleTrainerProfileWhere,
  isTrainerVisibleInClientDiscovery,
} from "@/lib/trainer-client-discovery";
import {
  effectiveClientBookingAvailability,
  minListPriceUsdOnLine,
  offeringServicesForPublicProfile,
  parseTrainerServiceOfferingsJson,
} from "@/lib/trainer-service-offerings-document";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

/** Short, public-safe bio snippet — never the full free-text bio verbatim beyond a preview length. */
function shortBio(bio: string | null): string | null {
  const trimmed = bio?.trim();
  if (!trimmed) return null;
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed;
}

function nichesArray(fitnessNiches: string | null): string[] {
  if (!fitnessNiches?.trim()) return [];
  return fitnessNiches
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function parseLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseBudget(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Public, unauthenticated coach search for the Northside Intelligence MCP agent storefront.
 * Reuses the exact same visibility rules as the authenticated client browse route
 * (`@/app/api/client/trainers/browse/route.ts`) — nationwide, online coaches only. No
 * city/zip/lat/long field or filter exists here on purpose (Match Fit is worldwide-online,
 * see MF-ATLANTA-GATES-AFTER-WORLDWIDE). geo-guard:allow
 */
export async function GET(req: Request) {
  try {
    const ip = getRequestClientIp(req);
    if (!simpleRateLimitAllow(`public-trainer-search:${ip}`, 60, 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const url = new URL(req.url);
    const specialtyRaw = url.searchParams.get("specialty")?.trim().slice(0, 120) || null;
    const maxMonthlyBudget = parseBudget(url.searchParams.get("max_monthly_budget"));
    const limit = parseLimit(url.searchParams.get("limit"));

    const trainers = await prisma.trainer.findMany({
      where: {
        ...publicMarketplaceVisibleTrainerWhere(),
        profile: clientDiscoveryVisibleTrainerProfileWhere(),
      },
      select: {
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        bio: true,
        fitnessNiches: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            limitedDashboardUnlockedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            accountTier: true,
            listingStatus: true,
            serviceOfferingsJson: true,
          },
        },
      },
      // Generous cap before in-memory filtering (specialty text + price aren't indexed
      // Prisma filters here); still bounded so this never scans the whole table unbounded.
      take: 500,
    });

    type Row = {
      username: string;
      displayName: string;
      shortBio: string | null;
      niches: string[];
      profileUrl: string;
      lowestPublishedPriceUsd: number | null;
    };

    const origin = getAppOrigin();
    const specialtyLower = specialtyRaw?.toLowerCase() ?? null;

    const results: Row[] = [];
    for (const t of trainers) {
      const profile = t.profile;
      if (!profile || !isTrainerVisibleInClientDiscovery(profile)) continue;

      const niches = nichesArray(t.fitnessNiches);

      if (specialtyLower) {
        const haystack = `${niches.join(" ")} ${t.bio ?? ""}`.toLowerCase();
        if (!haystack.includes(specialtyLower)) continue;
      }

      const doc = parseTrainerServiceOfferingsJson(profile.serviceOfferingsJson);
      const purchasableLines = offeringServicesForPublicProfile(doc).filter(
        (line) => effectiveClientBookingAvailability(line) !== "unavailable",
      );
      const lowestPublishedPriceUsd = purchasableLines.length
        ? Math.min(...purchasableLines.map((line) => minListPriceUsdOnLine(line)))
        : null;

      if (maxMonthlyBudget != null) {
        // Loose filter for an agent-facing search — price rows aren't all billed
        // per-month, so a coach with no published price never fails this filter and
        // one with a lowest price under the budget always passes it.
        if (lowestPublishedPriceUsd != null && lowestPublishedPriceUsd > maxMonthlyBudget) continue;
      }

      results.push({
        username: t.username,
        displayName: coachDisplayName(t),
        shortBio: shortBio(t.bio),
        niches,
        profileUrl: `${origin}/trainers/${encodeURIComponent(t.username)}`,
        lowestPublishedPriceUsd,
      });

      if (results.length >= limit) break;
    }

    const res = NextResponse.json({
      trainers: results,
      count: results.length,
      limit,
    });
    // Short public cache — coach discovery data changes slowly; agents/CDNs may cache briefly.
    res.headers.set("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");
    return res;
  } catch (e) {
    console.error("[public trainer search]", e);
    return NextResponse.json({ error: "Could not search coaches." }, { status: 500 });
  }
}
