"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import {
  ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY,
  ADMIN_DASHBOARD_SECTIONS,
  type AdminDashboardLayout,
  type AdminDashboardSectionGroup,
  type AdminDashboardSectionId,
  parseAdminDashboardLayout,
  serializeAdminDashboardLayout,
  visibleDashboardSections,
} from "@/lib/admin-dashboard-layout";
import type {
  AdminFeaturedSnapshot,
  AdminPortalOverview,
  AdminSignupRow,
  AdminUserStats,
} from "@/lib/admin-portal-types";
import type { AdminAuditLogRow } from "@/lib/admin-portal-data";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";
import { AdminDashboardLayoutCustomizer } from "./admin-dashboard-layout-customizer";
import {
  AcquisitionFunnelSection,
  FinancesDetailSection,
  OperationalAlertsSection,
  PlatformHealthSection,
  SiteTrafficSection,
  TrainerPipelineSection,
} from "./admin-dashboard-metrics";
import { AdminDashboardSection } from "./admin-dashboard-section";
import { AdminDashboardSectionNav } from "./admin-dashboard-section-nav";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type DirectoryRow =
  | {
      kind: "client";
      id: string;
      username: string;
      email: string;
      displayName: string;
      createdAt: string;
    }
  | {
      kind: "trainer";
      id: string;
      username: string;
      email: string;
      displayName: string;
      createdAt: string;
    };

function formatSignupDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statsSummary(kind: "client" | "trainer", stats: AdminUserStats) {
  const parts: string[] = [];
  if (kind === "client") {
    parts.push(stats.subscriptionActive ? "Sub active" : "Sub inactive");
  } else {
    parts.push(stats.dashboardActivated ? "Dashboard live" : "Onboarding");
    if (stats.backgroundCheckStatus) parts.push(`BG: ${stats.backgroundCheckStatus}`);
    if (stats.premiumStudio) parts.push("Premium");
  }
  parts.push(`${stats.completedPurchases} checkout${stats.completedPurchases === 1 ? "" : "s"}`);
  if (stats.grossVolumeCents > 0) parts.push(formatUsdFromCents(stats.grossVolumeCents));
  if (stats.safetySuspended) parts.push("Safety hold");
  return parts.join(" · ");
}

function SignupRowCard(props: {
  row: AdminSignupRow;
  busyKey: string | null;
  onOpen: (role: "client" | "trainer", userId: string) => void;
  compact?: boolean;
}) {
  const { row } = props;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 transition hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white/90">{row.displayName}</p>
          <span
            className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              row.kind === "client" ? "bg-violet-500/15 text-violet-300" : "bg-orange-500/15 text-orange-300"
            }`}
          >
            {row.kind}
          </span>
        </div>
        <p className="font-mono text-[11px] text-white/40">@{row.username}</p>
        {!props.compact ? <p className="text-[11px] text-white/30">{row.email}</p> : null}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          <span className="text-white/35">{formatSignupDate(row.createdAt)}</span>
          <span className="text-cyan-300/60">{statsSummary(row.kind, row.stats)}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={props.busyKey !== null}
        onClick={() => void props.onOpen(row.kind, row.id)}
        className="shrink-0 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
      >
        {props.busyKey === `${row.kind}:${row.id}` ? "Opening…" : "Open account"}
      </button>
    </div>
  );
}

function AdminDirectoryUserTable(props: {
  title: string;
  kind: "client" | "trainer";
  list: DirectoryRow[];
  busyKey: string | null;
  onImpersonate: (role: "client" | "trainer", userId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.5)]">
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <h2 className="text-xs font-semibold text-white/60">{props.title}</h2>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {props.list.length === 0 ? (
          <p className="px-4 py-5 text-sm text-white/35">No matches.</p>
        ) : (
          props.list.map((row) => (
            <div
              key={`${row.kind}-${row.id}`}
              className="flex flex-col gap-2 px-4 py-3 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white/90">{row.displayName}</p>
                <p className="font-mono text-[11px] text-white/40">@{row.username}</p>
                <p className="text-[11px] text-white/30">{row.email}</p>
              </div>
              <button
                type="button"
                disabled={props.busyKey !== null}
                onClick={() => void props.onImpersonate(props.kind, row.id)}
                className="shrink-0 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
              >
                {props.busyKey === `${props.kind}:${row.id}` ? "Opening…" : "Open account"}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FeaturedSnapshotList({ items }: { items: AdminFeaturedSnapshot[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-white/35">No featured allocations yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li
          key={`${f.displayDayKey}-${f.regionZipPrefix}-${f.trainerId}-${f.source}`}
          className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
        >
          <p className="font-semibold text-white/90">{f.displayName}</p>
          <p className="font-mono text-[11px] text-white/40">@{f.username}</p>
          <p className="mt-1 text-[11px] text-white/35">
            {f.displayDayLabel} · ZIP {f.regionZipPrefix}xx ·{" "}
            <span className={f.source === "PAID_BID" ? "text-amber-300/70" : "text-violet-300/70"}>
              {f.source === "PAID_BID" ? "Paid bid" : "Raffle"}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

const SECTION_META_BY_ID = Object.fromEntries(ADMIN_DASHBOARD_SECTIONS.map((s) => [s.id, s])) as Record<
  AdminDashboardSectionId,
  (typeof ADMIN_DASHBOARD_SECTIONS)[number]
>;

export function AdminDashboardClient(props: {
  initialOverview: AdminPortalOverview;
  initialTestMode: boolean;
  initialLayout: AdminDashboardLayout;
  administratorId: string;
  layoutLoadedFromServer: boolean;
  auditLog: AdminAuditLogRow[];
  visitorInsight: string;
}) {
  const overview = props.initialOverview;
  const { userCounts, revenue, recentSignups, recentFeatured, traffic, funnel, pipeline, finances, alerts, platformSummary } =
    overview;

  const layoutStorageKey = `${ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY}:${props.administratorId}`;

  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<{ clients: DirectoryRow[]; trainers: DirectoryRow[] } | null>(null);
  const [testMode, setTestMode] = useState(props.initialTestMode);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState(props.initialLayout);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSaveError, setLayoutSaveError] = useState<string | null>(null);
  const [layoutPersistedHint, setLayoutPersistedHint] = useState<string | null>(null);

  const [signupLog, setSignupLog] = useState<AdminSignupRow[]>([]);
  const [signupTotal, setSignupTotal] = useState(0);
  const [signupOffset, setSignupOffset] = useState(0);
  const [signupLoading, setSignupLoading] = useState(false);
  const signupPageSize = 25;

  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const loadDirectory = useCallback(async (query: string) => {
    const url = new URL("/api/admin/users", window.location.origin);
    url.searchParams.set("role", "both");
    if (query.trim()) url.searchParams.set("q", query.trim());
    const res = await fetch(url.toString(), { credentials: "include" });
    const data = (await res.json()) as { clients?: DirectoryRow[]; trainers?: DirectoryRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load directory.");
      return;
    }
    setRows({ clients: data.clients ?? [], trainers: data.trainers ?? [] });
    setError(null);
  }, []);

  const loadSignupLog = useCallback(async (offset: number, replace: boolean) => {
    setSignupLoading(true);
    try {
      const url = new URL("/api/admin/signups", window.location.origin);
      url.searchParams.set("limit", String(signupPageSize));
      url.searchParams.set("offset", String(offset));
      const res = await fetch(url.toString(), { credentials: "include" });
      const data = (await res.json()) as { rows?: AdminSignupRow[]; total?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load signup log.");
        return;
      }
      const nextRows = data.rows ?? [];
      setSignupLog((prev) => (replace ? nextRows : [...prev, ...nextRows]));
      setSignupTotal(data.total ?? 0);
      setSignupOffset(offset);
      setError(null);
    } finally {
      setSignupLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial directory + signup log */
  useEffect(() => {
    void loadDirectory("");
    void loadSignupLog(0, true);
  }, [loadDirectory, loadSignupLog]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadDirectory(q), 280);
    return () => window.clearTimeout(t);
  }, [q, loadDirectory]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (props.layoutLoadedFromServer) return;
    try {
      const raw = localStorage.getItem(layoutStorageKey);
      if (!raw) return;
      setLayout(parseAdminDashboardLayout(JSON.parse(raw)));
    } catch {
      /* ignore corrupt local layout */
    }
  }, [layoutStorageKey, props.layoutLoadedFromServer]);

  const orderedVisibleSections = useMemo(() => visibleDashboardSections(layout), [layout]);

  async function saveDashboardLayout(next: AdminDashboardLayout) {
    setLayoutSaving(true);
    setLayoutSaveError(null);
    setLayoutPersistedHint(null);
    try {
      localStorage.setItem(layoutStorageKey, serializeAdminDashboardLayout(next));
      const res = await fetch("/api/admin/dashboard-layout", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: next }),
      });
      const data = (await res.json()) as {
        error?: string;
        layout?: AdminDashboardLayout;
        persisted?: boolean;
        warning?: string;
      };
      if (!res.ok) {
        setLayoutSaveError(data.error ?? "Could not save dashboard layout.");
        return;
      }
      setLayout(parseAdminDashboardLayout(data.layout ?? next));
      if (data.warning) setLayoutPersistedHint(data.warning);
      setCustomizerOpen(false);
    } catch {
      setLayoutSaveError("Could not save dashboard layout.");
    } finally {
      setLayoutSaving(false);
    }
  }

  async function logout() {
    setBusyKey("logout");
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearEndUserSessions: true }),
      });
      navigateWithFullLoad("/admin/login");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleTestMode(enabled: boolean) {
    setError(null);
    if (TURNSTILE_SITE_KEY) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Complete the security check before changing test mode.");
        return;
      }
    }
    setBusyKey("testmode");
    try {
      const turnstileToken = TURNSTILE_SITE_KEY ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch("/api/admin/test-mode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, ...(turnstileToken ? { turnstileToken } : {}) }),
      });
      const data = (await res.json()) as { error?: string; testMode?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not update test mode.");
        turnstileRef.current?.reset();
        return;
      }
      setTestMode(Boolean(data.testMode));
      turnstileRef.current?.reset();
    } finally {
      setBusyKey(null);
    }
  }

  async function impersonate(role: "client" | "trainer", userId: string) {
    setError(null);
    if (TURNSTILE_SITE_KEY) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Complete the security check before opening a member account.");
        return;
      }
    }
    const key = `${role}:${userId}`;
    setBusyKey(key);
    try {
      const turnstileToken = TURNSTILE_SITE_KEY ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, userId, ...(turnstileToken ? { turnstileToken } : {}) }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start impersonation.");
        turnstileRef.current?.reset();
        return;
      }
      navigateWithFullLoad(data.next ?? "/");
    } finally {
      setBusyKey(null);
    }
  }

  const totalMembers = userCounts.clientsTotal + userCounts.trainersTotal;

  function renderSectionBody(id: AdminDashboardSectionId) {
    switch (id) {
      case "overview-kpis": {
        const kpis = [
          {
            label: "Total Members",
            value: totalMembers,
            sub: `${userCounts.clientsTotal} clients · ${userCounts.trainersTotal} trainers`,
            note: "Excludes test & QA accounts",
            accent: "border-t-cyan-500/50",
          },
          {
            label: "Active Clients",
            value: userCounts.clientsActive,
            sub: "Billing in good standing",
            accent: "border-t-violet-500/50",
          },
          {
            label: "Active Trainers",
            value: userCounts.trainersActive,
            sub: "Onboarded + recent activity",
            accent: "border-t-blue-500/50",
          },
          {
            label: "Client Subscribers",
            value: revenue.activePlatformSubscribers,
            sub: "$10/mo platform subscription",
            accent: "border-t-emerald-500/50",
          },
          {
            label: "Premium Trainers",
            value: revenue.activeTrainerPremiumSubscribers,
            sub: "$20/mo premium studio",
            accent: "border-t-amber-500/50",
          },
          {
            label: "Site Visitors (7d)",
            value: traffic.uniqueVisitors,
            sub: `${traffic.pageViews} views · ${traffic.linkClicks} clicks`,
            accent: "border-t-pink-500/50",
          },
        ];
        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={`rounded-xl border border-white/[0.08] border-t-2 ${k.accent} bg-[#0c0f14]/90 p-4 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.5)]`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{k.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">{k.value}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{k.sub}</p>
                {k.note ? <p className="mt-1 text-[10px] text-white/25">{k.note}</p> : null}
              </div>
            ))}
          </div>
        );
      }
      case "revenue-snapshot":
        return (
          <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#0c0f14]/90 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.6)]">
            <div className="border-b border-emerald-400/10 bg-emerald-500/[0.05] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">Platform Revenue</p>
              <div className="mt-2 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-white">{formatUsdFromCents(revenue.revenueCents)}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {revenue.eventCount} payment event{revenue.eventCount === 1 ? "" : "s"} · gross collected
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">Gross Profit</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-300">{formatUsdFromCents(revenue.grossProfitCents)}</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <ul className="space-y-2 text-xs text-white/50">
                <li className="flex justify-between gap-4">
                  <span>Services</span>
                  <span className="tabular-nums text-white/70">
                    {formatUsdFromCents(revenue.byCategory.SERVICE_CHECKOUT.grossProfitCents)} profit · {revenue.byCategory.SERVICE_CHECKOUT.eventCount} checkouts
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Client subs ($10/mo)</span>
                  <span className="tabular-nums text-white/70">{formatUsdFromCents(revenue.byCategory.CLIENT_PLATFORM_SUBSCRIPTION.grossProfitCents)} profit</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Trainer premium ($20/mo)</span>
                  <span className="tabular-nums text-white/70">{formatUsdFromCents(revenue.byCategory.TRAINER_PREMIUM_SUBSCRIPTION.grossProfitCents)} profit</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Other one-time</span>
                  <span className="tabular-nums text-white/70">{formatUsdFromCents(revenue.byCategory.ONE_TIME_PURCHASE.grossProfitCents)} profit</span>
                </li>
              </ul>
              <p className="mt-3 text-[10px] text-white/25">Live billing only — sandbox and test accounts excluded.</p>
            </div>
          </div>
        );
      case "platform-health":
        return <PlatformHealthSection panel={platformSummary} />;
      case "site-traffic":
        return <SiteTrafficSection traffic={traffic} />;
      case "acquisition-funnel":
        return <AcquisitionFunnelSection funnel={funnel} />;
      case "trainer-pipeline":
        return <TrainerPipelineSection pipeline={pipeline} />;
      case "finances-detail":
        return <FinancesDetailSection finances={finances} />;
      case "operational-alerts":
        return <OperationalAlertsSection alerts={alerts} />;
      case "impersonation-audit":
        return (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90">
            {props.auditLog.length === 0 ? (
              <p className="px-5 py-6 text-sm text-white/35">No impersonation events yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {props.auditLog.map((row) => (
                  <div key={row.id} className="px-4 py-3">
                    <p className="text-xs font-medium text-white/80">
                      {row.action} · {row.targetRole}{" "}
                      <span className="font-mono">@{row.targetUsername ?? row.targetId.slice(0, 8)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      {row.administratorEmail} · {formatSignupDate(row.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "ai-visitor-insights":
        return props.visitorInsight ? (
          <div className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0c0f14]/90">
            <div className="border-b border-cyan-400/10 bg-cyan-500/[0.05] px-5 py-3">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
                <span>✦</span> AI Analysis
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{props.visitorInsight}</p>
              <p className="mt-4 text-xs">
                <Link href="/admin/assistant" className="text-cyan-400/80 underline-offset-4 hover:underline hover:text-cyan-300">
                  Open AI assistant for deeper analysis →
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
            <p className="text-sm text-white/35">Insights unavailable.</p>
            <Link href="/admin/assistant" className="mt-2 block text-xs text-cyan-400/70 underline-offset-4 hover:underline">
              Open the AI assistant
            </Link>
          </div>
        );
      case "recent-signups":
        return (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90">
            {recentSignups.length === 0 ? (
              <p className="px-5 py-6 text-sm text-white/35">No signups yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentSignups.map((row) => (
                  <div key={`${row.kind}-${row.id}`} className="px-4 py-1">
                    <SignupRowCard row={row} busyKey={busyKey} onOpen={impersonate} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "recent-featured":
        return (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <FeaturedSnapshotList items={recentFeatured} />
          </div>
        );
      case "test-mode":
        return (
          <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[#0c0f14]/90">
            <div className="border-b border-amber-400/10 bg-amber-500/[0.04] px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">Test Mode</p>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-white/55">
                Toggle on while validating flows. External billing and messaging integrations still follow environment keys.
              </p>
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void toggleTestMode(!testMode)}
                className={`shrink-0 rounded-xl px-5 py-2.5 text-xs font-semibold transition disabled:opacity-40 ${
                  testMode
                    ? "border border-amber-300/35 bg-amber-500/15 text-amber-200"
                    : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
                }`}
              >
                {busyKey === "testmode" ? "Updating…" : testMode ? "● Test mode on" : "○ Test mode off"}
              </button>
            </div>
          </div>
        );
      case "signup-log":
        return (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
              <p className="text-xs text-white/40">{signupTotal} total registrations</p>
              {signupLog.length < signupTotal ? (
                <button
                  type="button"
                  disabled={signupLoading || busyKey !== null}
                  onClick={() => void loadSignupLog(signupOffset + signupPageSize, false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.05] disabled:opacity-40"
                >
                  {signupLoading ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </div>
            {signupLog.length === 0 && !signupLoading ? (
              <p className="px-5 py-6 text-sm text-white/35">No signups to show.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {signupLog.map((row) => (
                  <div key={`log-${row.kind}-${row.id}`} className="px-4 py-1">
                    <SignupRowCard row={row} busyKey={busyKey} onOpen={impersonate} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "member-search":
        return (
          <div className="space-y-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/25">⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search username, email, or phone…"
                className="w-full rounded-xl border border-white/[0.1] bg-[#0c0f14] py-3 pl-10 pr-4 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/15"
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <AdminDirectoryUserTable
                title="Clients"
                kind="client"
                list={rows?.clients ?? []}
                busyKey={busyKey}
                onImpersonate={impersonate}
              />
              <AdminDirectoryUserTable
                title="Trainers"
                kind="trainer"
                list={rows?.trainers ?? []}
                busyKey={busyKey}
                onImpersonate={impersonate}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const sectionsToRender = useMemo(() => {
    let lastGroup: AdminDashboardSectionGroup | null = null;
    return orderedVisibleSections.map((sectionId) => {
      const meta = SECTION_META_BY_ID[sectionId];
      const showGroupHeading = meta.group !== lastGroup;
      lastGroup = meta.group;
      return { sectionId, meta, showGroupHeading };
    });
  }, [orderedVisibleSections]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_100%_60%_at_50%_-5%,rgba(34,211,238,0.09),transparent_60%),radial-gradient(ellipse_60%_40%_at_80%_0%,rgba(99,102,241,0.07),transparent_50%)]"
      />

      {/* Page header */}
      <div className="relative border-b border-white/[0.06] bg-[#050608]/80 px-5 py-6 backdrop-blur-sm sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30">
                  <span className="text-xs text-cyan-400">⚡</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">Match Fit</p>
                  <h1 className="text-lg font-bold leading-tight text-white">Administrator Portal</h1>
                </div>
                <span className="ml-1 hidden rounded-md bg-[#FF7E00]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FF7E00]/70 sm:block">
                  v{MATCH_FIT_PRODUCT_VERSION_LABEL}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLayoutSaveError(null);
                  setLayoutPersistedHint(null);
                  setCustomizerOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/15"
              >
                <span aria-hidden className="text-[10px]">⊞</span>
                Customize
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busyKey !== null}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.07] hover:text-white/85 disabled:opacity-40"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="mt-4">
            <AdminPortalNav current="dashboard" />
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/40">
            Platform overview, signup activity, member search, and secure account access for operations and trust &
            safety.{" "}
            <Link href="/admin/beta-waitlists" className="text-cyan-300/70 underline-offset-4 hover:underline">
              Beta waitlists
            </Link>
            {" · "}
            <Link href="/privacy#platform-administration" className="text-cyan-300/70 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/terms#platform-administration" className="text-cyan-300/70 underline-offset-4 hover:underline">
              Terms
            </Link>
          </p>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">

        <AdminDashboardSectionNav layout={layout} />

        {orderedVisibleSections.length === 0 ? (
          <p className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-6 text-sm text-amber-100/90">
            All sections are hidden. Open <strong className="font-bold">Customize dashboard</strong> to show sections
            again.
          </p>
        ) : (
          <div className="space-y-10">
            {sectionsToRender.map(({ sectionId, meta, showGroupHeading }) => {
              const usesInternalHeading = [
                "platform-health",
                "site-traffic",
                "acquisition-funnel",
                "trainer-pipeline",
                "finances-detail",
                "operational-alerts",
              ].includes(sectionId);

              return (
                <Fragment key={sectionId}>
                  {showGroupHeading ? (
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/[0.06]" />
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{meta.group}</p>
                      <span className="h-px flex-1 bg-white/[0.06]" />
                    </div>
                  ) : null}
                  <AdminDashboardSection
                    id={sectionId}
                    title={usesInternalHeading ? undefined : meta.label}
                    description={usesInternalHeading ? undefined : meta.description}
                  >
                    {renderSectionBody(sectionId)}
                  </AdminDashboardSection>
                </Fragment>
              );
            })}
          </div>
        )}

        {customizerOpen ? (
          <AdminDashboardLayoutCustomizer
            layout={layout}
            saving={layoutSaving}
            saveError={layoutSaveError}
            persistedHint={layoutPersistedHint}
            onSave={(next) => void saveDashboardLayout(next)}
            onClose={() => setCustomizerOpen(false)}
          />
        ) : null}

        {TURNSTILE_SITE_KEY ? (
          <div className="flex justify-center rounded-2xl border border-white/[0.06] bg-[#0c0f14]/60 py-4">
            <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="border-t border-white/[0.06] pt-6 text-[11px] text-white/30">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg leading-relaxed">
              Impersonation is privileged and disclosed in our legal terms. Sign out and clear sessions when finished.
              Prefer sandbox Stripe keys on staging.
            </p>
            <Link href="/admin/sign-up" className="shrink-0 text-cyan-400/60 underline-offset-4 hover:text-cyan-300 hover:underline">
              New staff onboarding →
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
