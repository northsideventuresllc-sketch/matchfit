/** Client-safe types and helpers for the administrator dashboard (no Prisma / server imports). */

import type { PlatformSuccessRatingBreakdown } from "@/lib/platform-success-rating";

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
  topPages: AdminTrafficTopPage[];
  topLinks: AdminTrafficTopLink[];
  daily: AdminTrafficDayPoint[];
  recentEvents: {
    at: string;
    kind: "PAGE_VIEW" | "LINK_CLICK";
    path: string;
    target: string | null;
    label: string | null;
  }[];
};

export type AdminHomeUserCounts = {
  trainersTotal: number;
  trainersActive: number;
  clientsTotal: number;
  clientsActive: number;
};

export type AdminPortalOverview = {
  traffic: AdminTrafficSnapshot;
  userCounts: AdminHomeUserCounts;
  revenue: AdminRevenueSnapshot;
  recentSignups: AdminSignupRow[];
  recentFeatured: AdminFeaturedSnapshot[];
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
  /** Distinct signup-page visitors minus completed client accounts (approximation when analytics cannot be joined to accounts). */
  clientsReachedSignupWithoutAccount: number;
  trainerSignupPageViews: number;
  trainersReachedSignupWithoutAccount: number;
  activeOnSiteNow: number;
  clientLoginsByRecency: AdminLoginRecencyBuckets;
  trainerLoginsByRecency: AdminLoginRecencyBuckets;
  pendingClientRegistrations: { total: number; byStatus: Record<string, number> };
  incompleteTrainerSignups: number;
  trainersSignupBeforeBackgroundCheck: number;
  clientsInFreeTrial: number;
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

export type AdminTrainerPipelinePanel = {
  totalInPipeline: number;
  stages: AdminTrainerPipelineStage[];
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
  grossProfitCents: number | null;
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
  pendingSubscriptionStop: number | null;
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
};

export type AdminPortalDashboard = {
  trafficFunnel: AdminTrafficFunnelPanel;
  trainerPipeline: AdminTrainerPipelinePanel;
  finances: AdminFinancesPanel;
  alerts: AdminAlertsPanel;
  platformSummary: AdminPlatformSummaryPanel;
  /** Legacy overview fields retained for operations widgets. */
  traffic: AdminTrafficSnapshot;
  userCounts: AdminHomeUserCounts;
  revenue: AdminRevenueSnapshot;
  recentSignups: AdminSignupRow[];
  recentFeatured: AdminFeaturedSnapshot[];
};

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
