"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdminDashboardPanel,
  AdminMetricTile,
  AdminSeverityBadge,
} from "@/components/admin/admin-dashboard-panel";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import {
  formatUsdFromCents,
  type AdminAlertGroup,
  type AdminFinanceWindowKey,
  type AdminPortalDashboard,
  type AdminSignupRow,
  type AdminUserStats,
} from "@/lib/admin-portal-types";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const FINANCE_WINDOWS: { key: AdminFinanceWindowKey; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "1y", label: "1y" },
  { key: "5y", label: "5y" },
];

type DirectoryRow =
  | { kind: "client"; id: string; username: string; email: string; displayName: string; createdAt: string }
  | { kind: "trainer"; id: string; username: string; email: string; displayName: string; createdAt: string };

function formatSignupDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function formatTxDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function statsSummary(kind: "client" | "trainer", stats: AdminUserStats) {
  const parts: string[] = [];
  if (kind === "client") parts.push(stats.subscriptionActive ? "Sub active" : "Sub inactive");
  else {
    parts.push(stats.dashboardActivated ? "Dashboard live" : "Onboarding");
    if (stats.backgroundCheckStatus) parts.push(`BG: ${stats.backgroundCheckStatus}`);
    if (stats.premiumStudio) parts.push("Premium");
  }
  parts.push(`${stats.completedPurchases} checkout${stats.completedPurchases === 1 ? "" : "s"}`);
  if (stats.grossVolumeCents > 0) parts.push(formatUsdFromCents(stats.grossVolumeCents));
  if (stats.safetySuspended) parts.push("Safety hold");
  return parts.join(" · ");
}

function LoginBucketGrid(props: { title: string; buckets: AdminPortalDashboard["trafficFunnel"]["clientLoginsByRecency"] }) {
  const entries: { label: string; key: keyof typeof props.buckets }[] = [
    { label: "12h", key: "h12" },
    { label: "24h", key: "h24" },
    { label: "7d", key: "d7" },
    { label: "30d", key: "d30" },
    { label: "90d", key: "d90" },
    { label: "180d", key: "d180" },
    { label: "365d", key: "d365" },
  ];
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{props.title}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {entries.map((e) => (
          <div key={e.key} className="rounded-lg border border-white/[0.06] bg-[#07080c]/70 px-2 py-2 text-center">
            <p className="text-[10px] text-white/40">{e.label}</p>
            <p className="text-sm font-black tabular-nums text-white">{props.buckets[e.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupRowCard(props: {
  row: AdminSignupRow;
  busyKey: string | null;
  onOpen: (role: "client" | "trainer", userId: string) => void;
  compact?: boolean;
}) {
  const { row } = props;
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${
        props.compact ? "py-2.5" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">{row.displayName}</p>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${
              row.kind === "client" ? "bg-violet-500/15 text-violet-200" : "bg-orange-500/15 text-orange-100"
            }`}
          >
            {row.kind}
          </span>
        </div>
        <p className="font-mono text-xs text-white/45">@{row.username}</p>
        {!props.compact ? <p className="text-[11px] text-white/35">{row.email}</p> : null}
        <p className="mt-1 text-[11px] text-white/40">{formatSignupDate(row.createdAt)}</p>
        <p className="mt-1 text-[11px] text-cyan-200/70">{statsSummary(row.kind, row.stats)}</p>
      </div>
      <button
        type="button"
        disabled={props.busyKey !== null}
        onClick={() => void props.onOpen(row.kind, row.id)}
        className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-500/15 disabled:opacity-40"
      >
        {props.busyKey === `${row.kind}:${row.id}` ? "Opening…" : "Open account"}
      </button>
    </div>
  );
}

function AlertGroupSection({ group }: { group: AdminAlertGroup }) {
  return (
    <details className="rounded-xl border border-white/[0.06] bg-[#07080c]/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <AdminSeverityBadge severity={group.severity} />
          <span className="text-sm font-semibold text-white">{group.label}</span>
          <span className="text-xs text-white/40">({group.total})</span>
        </div>
        <span className="text-[10px] text-white/35">Expand</span>
      </summary>
      <ul className="space-y-2 border-t border-white/[0.06] px-3 py-3">
        {group.items.length === 0 ? (
          <li className="text-sm text-white/45">None right now.</li>
        ) : (
          group.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <AdminSeverityBadge severity={item.severity} />
                <p className="text-sm font-semibold text-white">{item.title}</p>
              </div>
              <p className="mt-1 text-[11px] text-white/45">{item.detail}</p>
              {item.href ? (
                <Link href={item.href} className="mt-1 inline-block text-[11px] text-cyan-300/90 hover:underline">
                  Review
                </Link>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </details>
  );
}

export function AdminDashboardClient(props: { initialDashboard: AdminPortalDashboard; initialTestMode: boolean }) {
  const { trafficFunnel, trainerPipeline, finances, alerts, platformSummary } = props.initialDashboard;

  const [financeWindow, setFinanceWindow] = useState<AdminFinanceWindowKey>("30d");
  const financeSnap = finances.windows[financeWindow];

  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<{ clients: DirectoryRow[]; trainers: DirectoryRow[] } | null>(null);
  const [testMode, setTestMode] = useState(props.initialTestMode);
  const [error, setError] = useState<string | null>(null);
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
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const t = window.setTimeout(() => void loadDirectory(q), 280);
    return () => window.clearTimeout(t);
  }, [q, loadDirectory]);

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

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(34,211,238,0.12),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/85">Match Fit</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Administrator Portal</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Collapsible platform panels for traffic, pipeline, finances, alerts, and summary metrics.{" "}
              <Link href="/admin/beta-waitlists" className="text-cyan-300/90 underline-offset-4 hover:underline">
                Beta waitlists
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={busyKey !== null}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white/80 hover:bg-white/[0.07] disabled:opacity-40"
          >
            Sign out
          </button>
        </header>

        {error ? (
          <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <AdminDashboardPanel
          title="Traffic & Funnel"
          subtitle="Homepage and signup funnel, live visitors, login recency, and top platform activity."
          defaultOpen
        >
          {!trafficFunnel.analyticsAvailable ? (
            <p className="mb-4 text-sm text-amber-200/80">Site analytics table unavailable — traffic metrics show zero until migration is applied.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricTile label="Homepage visits" value={trafficFunnel.homepageVisits} />
            <AdminMetricTile label="Total site visits" value={trafficFunnel.totalSiteVisits} />
            <AdminMetricTile label="Online now (15m)" value={trafficFunnel.activeOnSiteNow} hint="Distinct analytics sessions" />
            <AdminMetricTile label="Active subscriptions" value={trafficFunnel.activeClientSubscriptions} />
            <AdminMetricTile label="Client signup page views" value={trafficFunnel.clientSignupPageViews} />
            <AdminMetricTile label="Signup views, no account" value={trafficFunnel.clientsReachedSignupWithoutAccount} hint="Approx. via analytics + pending regs" />
            <AdminMetricTile label="Trainer signup page views" value={trafficFunnel.trainerSignupPageViews} />
            <AdminMetricTile label="Trainer signup, no account" value={trafficFunnel.trainersReachedSignupWithoutAccount} hint="Approx. visitor minus trainer rows" />
            <AdminMetricTile label="Clients in free trial" value={trafficFunnel.clientsInFreeTrial} hint="Active sub, no paid invoice yet" />
            <AdminMetricTile label="Pending client regs" value={trafficFunnel.pendingClientRegistrations.total} />
            <AdminMetricTile label="Incomplete trainer signups" value={trafficFunnel.incompleteTrainerSignups} />
            <AdminMetricTile label="Before background check" value={trafficFunnel.trainersSignupBeforeBackgroundCheck} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <LoginBucketGrid title="Client logins by recency" buckets={trafficFunnel.clientLoginsByRecency} />
            <LoginBucketGrid title="Trainer logins by recency" buckets={trafficFunnel.trainerLoginsByRecency} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Top client activity (7d)</p>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                {trafficFunnel.topClientFunctions.map((f) => (
                  <li key={f.key}>
                    {f.label}: <span className="font-semibold text-white">{f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Top trainer activity (7d)</p>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                {trafficFunnel.topTrainerFunctions.map((f) => (
                  <li key={f.key}>
                    {f.label}: <span className="font-semibold text-white">{f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AdminDashboardPanel>

        <AdminDashboardPanel title="Trainer Pipeline" subtitle="Onboarding stages excluding QA synthetic personas.">
          <p className="mb-4 text-sm text-white/50">{trainerPipeline.totalInPipeline} trainers in pipeline (signed up).</p>
          <div className="space-y-3">
            {trainerPipeline.stages.map((stage) => (
              <div key={stage.id} className="rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{stage.label}</p>
                  <p className="text-sm tabular-nums text-cyan-100">
                    {stage.count} <span className="text-white/40">({stage.percentOfSignup}%)</span>
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.min(100, stage.percentOfSignup)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </AdminDashboardPanel>

        <AdminDashboardPanel title="Finances" subtitle="Revenue, subscriptions, and recent transactions.">
          <div className="mb-4 flex flex-wrap gap-2">
            {FINANCE_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setFinanceWindow(w.key)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
                  financeWindow === w.key
                    ? "border border-cyan-400/40 bg-cyan-500/15 text-cyan-50"
                    : "border border-white/10 text-white/55 hover:bg-white/[0.05]"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricTile label="Revenue" value={formatUsdFromCents(financeSnap.revenueCents)} />
            <AdminMetricTile label="Gross profit" value={formatUsdFromCents(financeSnap.grossProfitCents)} />
            <AdminMetricTile label="Platform fees" value={formatUsdFromCents(financeSnap.platformFeesCents)} />
            <AdminMetricTile label="Premium trainers" value={finances.premiumTrainers} />
            <AdminMetricTile label="Clients in trial" value={finances.clientsInFreeTrial} />
            <AdminMetricTile label="Payment failed (grace)" value={finances.paymentFailedInGrace} />
            <AdminMetricTile label="Cards connected" value={finances.clientsWithCard} />
            <AdminMetricTile label="Featured today" value={finances.featuredTrainersToday} />
          </div>
          {finances.pendingSubscriptionStop === null ? (
            <p className="mt-3 text-[11px] text-white/40">Pending subscription stops: N/A (requires live Stripe cancel_at_period_end sync).</p>
          ) : null}
          {finances.trainersWithCard === null ? (
            <p className="mt-1 text-[11px] text-white/40">Trainer payout cards: N/A (Connect account field not stored locally).</p>
          ) : null}
          {financeSnap.leadingRevenueFactor ? (
            <p className="mt-4 text-sm text-white/60">
              Leading revenue factor:{" "}
              <span className="font-semibold text-white">{financeSnap.leadingRevenueFactor.category.replace(/_/g, " ")}</span>{" "}
              ({formatUsdFromCents(financeSnap.leadingRevenueFactor.grossProfitCents)} profit)
            </p>
          ) : null}
          <div className="mt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Recent transactions</p>
            <ul className="mt-2 space-y-2">
              {finances.recentTransactions.slice(0, 10).map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#07080c]/70 px-3 py-2 text-sm">
                  <span className="text-white/80">{tx.label}</span>
                  <span className="tabular-nums text-white">{formatUsdFromCents(tx.amountCents)}</span>
                  <span className="text-[11px] text-white/40">{formatTxDate(tx.occurredAt)}</span>
                </li>
              ))}
            </ul>
          </div>
          {finances.bestSellers.length > 0 ? (
            <div className="mt-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Best sellers (30d)</p>
              <ul className="mt-2 space-y-2">
                {finances.bestSellers.map((s) => (
                  <li key={s.trainerId} className="rounded-lg border border-white/[0.06] bg-[#07080c]/70 px-3 py-2 text-sm">
                    <span className="font-semibold text-white">{s.displayName}</span>
                    <span className="text-white/40"> · </span>
                    {formatUsdFromCents(s.volumeCents)} · {s.transactionCount} checkout{s.transactionCount === 1 ? "" : "s"}
                    {s.topOfferingName ? <span className="text-white/50"> · {s.topOfferingName}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </AdminDashboardPanel>

        <AdminDashboardPanel title="Alerts" subtitle="Actionable trust, safety, and billing items." badge={<AdminSeverityBadge severity="warning" />}>
          <div className="space-y-3">
            {alerts.groups.map((group) => (
              <AlertGroupSection key={group.id} group={group} />
            ))}
          </div>
        </AdminDashboardPanel>

        <AdminDashboardPanel title="Platform Summary" subtitle="Health scores, lifetime totals, and success rating.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricTile
              label="Active users"
              value={platformSummary.userCounts.clientsActive + platformSummary.userCounts.trainersActive}
              hint={`${platformSummary.userCounts.clientsActive} clients · ${platformSummary.userCounts.trainersActive} trainers`}
            />
            <AdminMetricTile label="Stability score" value={`${platformSummary.stabilityScore}/100`} />
            <AdminMetricTile label="Security score" value={`${platformSummary.securityScore}/100`} />
            <AdminMetricTile label="Success rating" value={`${platformSummary.successRating.score}/10`} hint="Hover factors in tooltip below" />
            <AdminMetricTile label="Lifetime revenue" value={formatUsdFromCents(platformSummary.lifetimeRevenueCents)} />
            <AdminMetricTile label="Lifetime gross profit" value={formatUsdFromCents(platformSummary.lifetimeGrossProfitCents)} />
          </div>
          <details className="mt-4 rounded-xl border border-white/[0.06] bg-[#07080c]/70 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-cyan-100">Success rating breakdown</summary>
            <ul className="mt-3 space-y-1 text-[11px] text-white/55">
              {platformSummary.successRating.factors.map((f) => (
                <li key={f.id}>
                  {f.label}: raw {f.raw.toFixed(2)} → +{f.contribution.toFixed(2)} pts
                </li>
              ))}
            </ul>
          </details>
        </AdminDashboardPanel>

        <AdminDashboardPanel title="Operations" subtitle="Member search, signup log, test mode, and impersonation.">
          <section className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/90">Test mode</p>
                <p className="mt-1 text-sm text-white/70">Toggle on while validating flows.</p>
              </div>
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void toggleTestMode(!testMode)}
                className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-40 ${
                  testMode
                    ? "border border-amber-300/40 bg-amber-500/20 text-amber-50"
                    : "border border-white/15 bg-white/[0.05] text-white/75 hover:bg-white/[0.08]"
                }`}
              >
                {busyKey === "testmode" ? "Updating…" : testMode ? "Test mode on" : "Test mode off"}
              </button>
            </div>
          </section>

          {TURNSTILE_SITE_KEY ? (
            <div className="mt-4 flex justify-center rounded-2xl border border-white/[0.06] bg-[#0c0f14]/60 py-4">
              <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Signup log</h3>
                <p className="mt-1 text-sm text-white/50">{signupTotal} total registrations</p>
              </div>
              {signupLog.length < signupTotal ? (
                <button
                  type="button"
                  disabled={signupLoading || busyKey !== null}
                  onClick={() => void loadSignupLog(signupOffset + signupPageSize, false)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/75 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  {signupLoading ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-2">
              {signupLog.map((row) => (
                <SignupRowCard key={`log-${row.kind}-${row.id}`} row={row} busyKey={busyKey} onOpen={impersonate} />
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Member search</h3>
              <p className="mt-1 text-sm text-white/50">Search by username, email, or phone.</p>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search username, email, or phone…"
              className="w-full rounded-xl border border-white/[0.1] bg-[#07080c] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/20"
            />
            <div className="grid gap-6 lg:grid-cols-2">
              {(
                [
                  { title: "Clients", kind: "client" as const, list: rows?.clients ?? [] },
                  { title: "Trainers", kind: "trainer" as const, list: rows?.trainers ?? [] },
                ] as const
              ).map(({ title, kind, list }) => (
                <section key={kind} className="rounded-xl border border-white/[0.06] bg-[#07080c]/70 p-4">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{title}</h4>
                  <div className="mt-3 space-y-2">
                    {list.length === 0 ? (
                      <p className="text-sm text-white/45">No matches.</p>
                    ) : (
                      list.map((row) => (
                        <div
                          key={`${row.kind}-${row.id}`}
                          className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">{row.displayName}</p>
                            <p className="font-mono text-xs text-white/45">@{row.username}</p>
                            <p className="text-[11px] text-white/35">{row.email}</p>
                          </div>
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => void impersonate(kind, row.id)}
                            className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-500/15 disabled:opacity-40"
                          >
                            {busyKey === `${kind}:${row.id}` ? "Opening…" : "Open account"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </AdminDashboardPanel>

        <footer className="border-t border-white/[0.08] pt-6 text-xs text-white/40">
          <p>Impersonation is privileged and disclosed in our legal terms. Sign out when finished.</p>
          <p className="mt-3">
            <Link href="/admin/sign-up" className="text-cyan-300/90 underline-offset-4 hover:underline">
              New staff onboarding form
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
