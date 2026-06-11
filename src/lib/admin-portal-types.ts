/** Client-safe types and helpers for the administrator dashboard (no Prisma / server imports). */

import type { PlatformGrowthProjection } from "@/lib/platform-growth-projection";
import type { PlatformPotentialRatingBreakdown } from "@/lib/platform-potential-rating";
import type { PlatformSuccessRatingBreakdown } from "@/lib/platform-success-rating";
import type { PlatformValuationBreakdown } from "@/lib/platform-valuation";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";

export type AdminUserStats = {
  completedPurchases: number;
  /** Client: total charged as buyer; trainer: gross from completed service checkouts. */
  grossVolumeCents: number;
  subscriptionActive: boolean | null;
  dashboardActivated: boolean | null;
  backgroundCheckStatus: string | null;
  premiumStudio: boolean | null;
  safetySuspended: boolean;
};

export type AdminSignupRow = {
  kind: "client" | "trainer";
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
  stats: AdminUserStats;
};

export type AdminFeaturedSnapshot = {
  displayDayKey: string;
  displayDayLabel: string;
  regionZipPrefix: string;
  source: "PAID_BID" | "RAFFLE";
  trainerId: string;
  username: string;
  displayName: string;
};

export type AdminRevenueByCategory = Record<
  string,
  { revenueCents: number; grossProfitCents: number; eventCount: number }
>;

export type AdminRevenueSnapshot = {
  revenueCents: number;
  grossProfitCents: number;
  eventCount: number;
  byCategory: AdminRevenueByCategory;
  activePlatformSubscribers: number;
  activeTrainerPremiumSubscribers: number;
};

export type AdminTrafficTopPage = {
  path: string;
  views: number;
};

export type AdminTrafficTopLink = {
  target: string;
  label: string | null;
  clicks: number;
};

export type AdminTrafficDayPoint = {
  dayKey: string;
  pageViews: number;
  uniqueVisitors: number;
};

export type AdminTrafficSnapshot = {
  windowDays: number;
  pageViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  formEvents: {
    fieldFocus: number;
    submitAttempts: number;
    submitErrors: number;
    submitSuccesses: number;
  };
  topPages: AdminTrafficTopPage[];
  topLinks: AdminTrafficTopLink[];
  daily: AdminTrafficDayPoint[];
  recentEvents: {
    at: string;
    kind:
      | "PAGE_VIEW"
      | "LINK_CLICK"
      | "FORM_FIELD_FOCUS"
      | "FORM_SUBMIT_ATTEMPT"
      | "FORM_SUBMIT_ERROR"
      | "FORM_SUBMIT_SUCCESS";
    path: string;
    target: string | null;
    label: string | null;
  }[];
};

export type AdminHomeUserCounts = {
  trainersTotal: number;
  trainersPending: number;
  trainersActive: number;
  clientsTotal: number;
  clientsActive: number;
};

export type AdminMemberOverviewPanel = {
  allMembersTotal: number;
  freeTrialClients: number;
  subscribedClients: number;
  inactiveClients: number;
  uniqueSiteVisitorsAllTime: number;
  pendingTrainers: number;
  compliantActiveTrainers: number;
  inactiveTrainers: number;
};

export type AdminPipelineStage = {
  id: string;
  label: string;
  count: number;
};

export type AdminPipelineEntry = {
  id: string;
  label: string;
  email: string | null;
  username: string | null;
  role: "client" | "trainer";
  filledFields: string[];
  missingFields: string[];
  createdAt: string | null;
};

export type AdminClientPipelinePanel = {
  stages: AdminPipelineStage[];
  entries: AdminPipelineEntry[];
};

export type AdminTrainerPipelineEntry = {
  trainerId: string;
  username: string;
  displayName: string;
  deidentified?: boolean;
  termsAccepted: boolean;
  complianceWindowStarted: boolean;
  onboardingFeeCompleted: boolean;
  onboardingFeeHoldPlaced: boolean;
  backgroundCheckStatus: string;
  backgroundCheckReviewStatus: string | null;
  documentsComplete: boolean;
  documentsPending: boolean;
};

export type AdminTrainerPipelinePanel = {
  totalInPipeline: number;
  stages: AdminTrainerPipelineStage[];
  pendingTrainers: AdminTrainerPipelineEntry[];
};

export type AdminSiteActivityPanel = {
  activeMembersNow: number;
  clientLoginsByRecency: AdminLoginRecencyBuckets;
  trainerLoginsByRecency: AdminLoginRecencyBuckets;
  topClientFunctions: AdminPlatformFunctionStat[];
  topTrainerFunctions: AdminPlatformFunctionStat[];
};

export type AdminPremiumTrainerActivityPanel = {
  premiumTrainers: number;
  featuredSlotsToday: number;
  activeAdvertisements: number;
  tokenRevenueCents: number;
  recentBids: { trainerUsername: string; regionZipPrefix: string; amountCents: number; displayDayKey: string }[];
};

export type AdminEmailStatsPanel = {
  windowDays: number;
  totalAttempts: number;
  sent: number;
  skippedPrefs: number;
  skippedNoRecipient: number;
  failed: number;
  byKind: { kind: string; sent: number; failed: number }[];
  recent: {
    id: string;
    at: string;
    kind: string;
    toEmail: string;
    status: string;
    subject: string;
  }[];
};

export type AdminLoginRecencyBuckets = {
  h12: number;
  h24: number;
  d7: number;
  d30: number;
  d90: number;
  d180: number;
  d365: number;
};

export type AdminPlatformFunctionStat = {
  key: string;
  label: string;
  count: number;
};

export type AdminTrafficFunnelPanel = {
  homepageVisits: number;
  totalSiteVisits: number;
  clientSignupPageViews: number;
  clientsReachedSignupWithoutAccount: number;
  trainerSignupPageViews: number;
  trainersReachedSignupWithoutAccount: number;
  activeOnSiteNow: number;
  clientLoginsByRecency: AdminLoginRecencyBuckets;
  trainerLoginsByRecency: AdminLoginRecencyBuckets;
  pendingClientRegistrations: { total: number; byStatus: Record<string, number> };
  /** Trainer account exists but marketplace dashboard is not live yet. */
  incompleteTrainerSignups: number;
  /** Trainer has not paid registration fee / unlocked limited dashboard (new signup flow). */
  trainersBeforeRegistrationPayment: number;
  /** Trainer row exists but Terms of Service not accepted yet. */
  trainersBeforeTerms: number;
  /** Card-free founding trial or Stripe trial before first paid invoice. */
  clientsInFreeTrial: number;
  clientsInPlatformTrial: number;
  clientsInStripeTrial: number;
  /** Post-trial window before card/subscription is required (card-free path). */
  clientsInPlatformPaymentGrace: number;
  activeClientSubscriptions: number;
  topClientFunctions: AdminPlatformFunctionStat[];
  topTrainerFunctions: AdminPlatformFunctionStat[];
  analyticsAvailable: boolean;
};

export type AdminTrainerPipelineStage = {
  id: string;
  label: string;
  count: number;
  percentOfSignup: number;
};


export type AdminFinanceWindowKey = "24h" | "7d" | "30d" | "90d" | "1y" | "5y";

export type AdminFinanceWindowSnapshot = {
  revenueCents: number;
  grossProfitCents: number;
  byCategory: AdminRevenueByCategory;
  platformFeesCents: number;
  leadingRevenueFactor: { category: string; grossProfitCents: number } | null;
};

export type AdminFinanceRecentTransaction = {
  id: string;
  source: "platform_revenue" | "service_checkout";
  occurredAt: string;
  label: string;
  amountCents: number;
  grossProfitCents: number;
  clientId: string | null;
  trainerId: string | null;
};

export type AdminFinanceBestSeller = {
  trainerId: string;
  username: string;
  displayName: string;
  volumeCents: number;
  transactionCount: number;
  topOfferingName: string | null;
};

export type AdminFinancesPanel = {
  windows: Record<AdminFinanceWindowKey, AdminFinanceWindowSnapshot>;
  lifetime: AdminFinanceWindowSnapshot & { eventCount: number };
  clientsInFreeTrial: number;
  clientsInPlatformTrial: number;
  clientsInStripeTrial: number;
  clientsInPlatformPaymentGrace: number;
  pendingSubscriptionStop: number | null;
  /** Stripe subscription lapsed — billing retry grace (`subscriptionGraceUntil`). */
  paymentFailedInGrace: number;
  clientsWithCard: number;
  activeSubscriptions: number;
  recentTransactions: AdminFinanceRecentTransaction[];
  premiumTrainers: number;
  trainersWithCard: number | null;
  featuredTrainersToday: number;
  bestSellers: AdminFinanceBestSeller[];
};

export type AdminAlertSeverity = "critical" | "warning" | "info";

export type AdminAlertItem = {
  id: string;
  severity: AdminAlertSeverity;
  title: string;
  detail: string;
  href: string | null;
  createdAt: string | null;
};

export type AdminAlertGroup = {
  id: string;
  label: string;
  severity: AdminAlertSeverity;
  items: AdminAlertItem[];
  total: number;
};

export type AdminAlertsPanel = {
  groups: AdminAlertGroup[];
};

export type AdminPlatformSummaryPanel = {
  userCounts: AdminHomeUserCounts;
  stabilityScore: number;
  stabilityNotes: string[];
  securityScore: number;
  securityNotes: string[];
  lifetimeRevenueCents: number;
  lifetimeGrossProfitCents: number;
  successRating: PlatformSuccessRatingBreakdown;
  valuation: PlatformValuationBreakdown;
  potentialRating: PlatformPotentialRatingBreakdown;
  growthProjection: PlatformGrowthProjection;
};

export type AdminPortalOverview = {
  computedAt: string;
  traffic: AdminTrafficSnapshot;
  userCounts: AdminHomeUserCounts;
  memberOverview: AdminMemberOverviewPanel;
  revenue: AdminRevenueSnapshot;
  recentFeatured: AdminFeaturedSnapshot[];
  siteActivity: AdminSiteActivityPanel;
  adPerformance: AdPerformancePanel;
  clientPipeline: AdminClientPipelinePanel;
  pipeline: AdminTrainerPipelinePanel;
  premiumActivity: AdminPremiumTrainerActivityPanel;
  finances: AdminFinancesPanel;
  emailStats: AdminEmailStatsPanel;
  alerts: AdminAlertsPanel;
  platformSummary: AdminPlatformSummaryPanel;
};

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
