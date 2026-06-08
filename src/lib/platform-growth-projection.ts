/**
 * Realistic monthly revenue projection and early-stage valuation range for admin analytics.
 */

import type { GrowthRecommendation } from "@/lib/platform-potential-rating";
import { TRAINER_PREMIUM_SUBSCRIPTION_USD } from "@/lib/platform-revenue-accounting";
import { TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD } from "@/lib/tos-implementation-contract";

export type PlatformGrowthProjection = {
  realisticMonthlyRevenueCents: number;
  realisticMonthlyGrossProfitCents: number;
  recurringMrrCents: number;
  valuationLowCents: number;
  valuationMidCents: number;
  valuationHighCents: number;
  assumptions: string[];
  revenueRecommendations: GrowthRecommendation[];
};

const CLIENT_SUB_CENTS = TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD * 100;
const TRAINER_PREMIUM_CENTS = TRAINER_PREMIUM_SUBSCRIPTION_USD * 100;

export function computePlatformGrowthProjection(args: {
  activeClientSubscriptions: number;
  premiumTrainers: number;
  clientsInFreeTrial: number;
  clientsWithCard: number;
  revenue30dCents: number;
  grossProfit30dCents: number;
  uniqueVisitors30d: number;
  clientSignupPageViews7d: number;
  pendingClientRegistrations: number;
  daysSinceLaunch: number;
}): PlatformGrowthProjection {
  const recurringMrrCents =
    args.activeClientSubscriptions * CLIENT_SUB_CENTS + args.premiumTrainers * TRAINER_PREMIUM_CENTS;

  const trialConversionRate = args.daysSinceLaunch < 30 ? 0.28 : 0.38;
  const trialConversionCents = Math.round(args.clientsInFreeTrial * trialConversionRate * CLIENT_SUB_CENTS);

  const cardOnFileCents = Math.round(
    Math.max(0, args.clientsWithCard - args.activeClientSubscriptions) * 0.45 * CLIENT_SUB_CENTS,
  );

  const serviceRunRateCents = Math.max(0, args.revenue30dCents - recurringMrrCents);
  const visitorSignupRate = args.uniqueVisitors30d > 0 ? args.clientSignupPageViews7d / args.uniqueVisitors30d : 0;
  const visitorConversionCents = Math.round(
    args.uniqueVisitors30d * Math.max(0.015, visitorSignupRate * 0.25) * CLIENT_SUB_CENTS * 0.4,
  );

  const pendingRegistrationCents = Math.round(args.pendingClientRegistrations * 0.2 * CLIENT_SUB_CENTS);

  const realisticMonthlyRevenueCents =
    recurringMrrCents +
    trialConversionCents +
    cardOnFileCents +
    serviceRunRateCents +
    visitorConversionCents +
    pendingRegistrationCents;

  const observedMargin =
    args.revenue30dCents > 0 ? args.grossProfit30dCents / args.revenue30dCents : 0.48;
  const realisticMonthlyGrossProfitCents = Math.round(
    realisticMonthlyRevenueCents * Math.min(0.72, Math.max(0.42, observedMargin)),
  );

  const arrCents = realisticMonthlyRevenueCents * 12;
  const valuationLowCents = Math.round(arrCents * 2.5);
  const valuationMidCents = Math.round(arrCents * 4);
  const valuationHighCents = Math.round(arrCents * 6);

  const assumptions = [
    `${Math.round(trialConversionRate * 100)}% of free-trial clients convert to paid this month.`,
    "Service and checkout revenue holds at the last 30-day run rate.",
    "Visitor and pending-registration uplifts use conservative conversion, not best-case ads performance.",
    "Valuation uses 2.5×–6× projected ARR, typical for an early marketplace beta with recurring revenue.",
  ];

  const revenueRecommendations: GrowthRecommendation[] = [];

  if (args.clientsInFreeTrial > 0) {
    revenueRecommendations.push({
      id: "trials",
      label: "Convert active trials",
      action: `You have ${args.clientsInFreeTrial} client(s) in free trial. Send a day-5 value recap and a day-7 subscribe reminder to capture ~$${(
        (args.clientsInFreeTrial * trialConversionRate * TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD) /
        1
      ).toFixed(0)}/mo at current conversion assumptions.`,
      impact: "high",
    });
  }

  if (args.clientsWithCard > args.activeClientSubscriptions) {
    revenueRecommendations.push({
      id: "cards",
      label: "Close card-on-file gap",
      action:
        "Follow up with clients who saved a card but are not subscribed yet — one in-app nudge plus a concise email often closes this gap within the month.",
      impact: "high",
    });
  }

  if (args.clientSignupPageViews7d > 0 && args.activeClientSubscriptions < 5) {
    revenueRecommendations.push({
      id: "signup-funnel",
      label: "Improve signup page conversion",
      action:
        "A/B test the client signup headline and add social proof above the form. Even a 1–2 point conversion lift on current signup page views moves monthly revenue meaningfully at this stage.",
      impact: "high",
    });
  }

  if (args.premiumTrainers < 3) {
    revenueRecommendations.push({
      id: "premium-trainers",
      label: "Grow Premium Hub subscribers",
      action: `Each premium trainer adds $${TRAINER_PREMIUM_SUBSCRIPTION_USD}/mo platform revenue. Target 3–5 active premium trainers before scaling paid acquisition.`,
      impact: "medium",
    });
  }

  if (serviceRunRateCents > 0) {
    revenueRecommendations.push({
      id: "services",
      label: "Keep service checkout momentum",
      action:
        "Promote best-selling trainer packages on the homepage and in Fit Hub so service revenue does not dip while subscription MRR grows.",
      impact: "medium",
    });
  }

  if (revenueRecommendations.length === 0) {
    revenueRecommendations.push({
      id: "baseline",
      label: "Establish recurring baseline",
      action:
        "Focus first on paid client subscriptions and at least one premium trainer — recurring MRR makes both revenue forecasts and valuation credible.",
      impact: "high",
    });
  }

  return {
    realisticMonthlyRevenueCents,
    realisticMonthlyGrossProfitCents,
    recurringMrrCents,
    valuationLowCents,
    valuationMidCents,
    valuationHighCents,
    assumptions,
    revenueRecommendations: revenueRecommendations.slice(0, 4),
  };
}
