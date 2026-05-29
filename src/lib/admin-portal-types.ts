/** Client-safe types and helpers for the administrator dashboard (no Prisma / server imports). */

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

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
