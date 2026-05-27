"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import type {
  AdminFeaturedSnapshot,
  AdminPortalOverview,
  AdminSignupRow,
  AdminUserStats,
} from "@/lib/admin-portal-data";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

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

function AdminDirectoryUserTable(props: {
  title: string;
  kind: "client" | "trainer";
  list: DirectoryRow[];
  busyKey: string | null;
  onImpersonate: (role: "client" | "trainer", userId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-4 backdrop-blur-md sm:p-5">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{props.title}</h2>
      <div className="mt-3 space-y-2">
        {props.list.length === 0 ? (
          <p className="text-sm text-white/45">No matches.</p>
        ) : (
          props.list.map((row) => (
            <div
              key={`${row.kind}-${row.id}`}
              className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{row.displayName}</p>
                <p className="font-mono text-xs text-white/45">@{row.username}</p>
                <p className="text-[11px] text-white/35">{row.email}</p>
              </div>
              <button
                type="button"
                disabled={props.busyKey !== null}
                onClick={() => void props.onImpersonate(props.kind, row.id)}
                className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-500/15 disabled:opacity-40"
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
    return <p className="text-sm text-white/45">No featured allocations yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li
          key={`${f.displayDayKey}-${f.regionZipPrefix}-${f.trainerId}-${f.source}`}
          className="rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-3 py-2.5"
        >
          <p className="font-semibold text-white">{f.displayName}</p>
          <p className="font-mono text-xs text-white/45">@{f.username}</p>
          <p className="mt-1 text-[11px] text-white/40">
            {f.displayDayLabel} · ZIP {f.regionZipPrefix}xx · {f.source === "PAID_BID" ? "Paid bid" : "Raffle"}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboardClient(props: {
  initialOverview: AdminPortalOverview;
  initialTestMode: boolean;
}) {
  const { userCounts, revenue, recentSignups, recentFeatured } = props.initialOverview;

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

  useEffect(() => {
    const t = window.setTimeout(() => void loadDirectory(q), 280);
    return () => window.clearTimeout(t);
  }, [q, loadDirectory]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(34,211,238,0.12),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/85">Match Fit</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Administrator Portal</h1>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/60">
              Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Platform overview, signup activity, member search, and secure account access for operations and trust &
              safety.{" "}
              <Link href="/admin/beta-waitlists" className="text-cyan-300/90 underline-offset-4 hover:underline">
                Beta waitlists
              </Link>
              . Account access is disclosed in our{" "}
              <Link href="/privacy#platform-administration" className="text-cyan-300/90 underline-offset-4 hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms#platform-administration" className="text-cyan-300/90 underline-offset-4 hover:underline">
                Terms
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

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Total members</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{totalMembers}</p>
            <p className="mt-1 text-xs text-white/40">
              {userCounts.clientsTotal} clients · {userCounts.trainersTotal} trainers
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Active clients</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{userCounts.clientsActive}</p>
            <p className="mt-1 text-xs text-white/40">Billing in good standing</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Active trainers</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{userCounts.trainersActive}</p>
            <p className="mt-1 text-xs text-white/40">Onboarded + recent activity</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Platform subscribers</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{revenue.activePlatformSubscribers}</p>
            <p className="mt-1 text-xs text-white/40">Stripe subscription active</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 lg:col-span-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/80">Platform revenue</p>
            <p className="mt-2 text-2xl font-black tabular-nums text-white">
              {formatUsdFromCents(revenue.revenueCents)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {revenue.eventCount} recorded payment event{revenue.eventCount === 1 ? "" : "s"} (gross collected)
            </p>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/70">
              Gross platform profit
            </p>
            <p className="mt-1 text-xl font-black tabular-nums text-emerald-50">
              {formatUsdFromCents(revenue.grossProfitCents)}
            </p>
            <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-white/45">
              <li>
                Services: {formatUsdFromCents(revenue.byCategory.SERVICE_CHECKOUT.grossProfitCents)} profit (
                {revenue.byCategory.SERVICE_CHECKOUT.eventCount} checkouts)
              </li>
              <li>
                Client subs ($10/mo): {formatUsdFromCents(revenue.byCategory.CLIENT_PLATFORM_SUBSCRIPTION.grossProfitCents)}{" "}
                profit
              </li>
              <li>
                Trainer premium ($20/mo):{" "}
                {formatUsdFromCents(revenue.byCategory.TRAINER_PREMIUM_SUBSCRIPTION.grossProfitCents)} profit
              </li>
              <li>
                Other one-time: {formatUsdFromCents(revenue.byCategory.ONE_TIME_PURCHASE.grossProfitCents)} profit
              </li>
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Gross profit excludes Match Fit operating costs. Service profit is the admin fee; subscriptions are $10 / $20
              platform portions; other purchases are total charged minus processor fee.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5 lg:col-span-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Recent signups</h2>
            <div className="mt-3 space-y-2">
              {recentSignups.length === 0 ? (
                <p className="text-sm text-white/45">No signups yet.</p>
              ) : (
                recentSignups.map((row) => (
                  <SignupRowCard key={`${row.kind}-${row.id}`} row={row} busyKey={busyKey} onOpen={impersonate} compact />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5 lg:col-span-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Recent featured trainers</h2>
            <div className="mt-3">
              <FeaturedSnapshotList items={recentFeatured} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/90">Test mode</p>
              <p className="mt-1 text-sm text-white/70">
                Toggle on while validating flows. External billing and messaging integrations still follow environment keys.
              </p>
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
          <div className="flex justify-center rounded-2xl border border-white/[0.06] bg-[#0c0f14]/60 py-4">
            <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Signup log</h2>
              <p className="mt-1 text-sm text-white/50">
                All client and trainer registrations, newest first ({signupTotal} total).
              </p>
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
            {signupLog.length === 0 && !signupLoading ? (
              <p className="text-sm text-white/45">No signups to show.</p>
            ) : (
              signupLog.map((row) => (
                <SignupRowCard key={`log-${row.kind}-${row.id}`} row={row} busyKey={busyKey} onOpen={impersonate} />
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Member search</h2>
            <p className="mt-1 text-sm text-white/50">
              Search by username, email, or phone, then open the member&apos;s dashboard in a supervised session.
            </p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username, email, or phone…"
            className="w-full rounded-xl border border-white/[0.1] bg-[#07080c] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/20"
          />
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
        </section>

        <footer className="border-t border-white/[0.08] pt-6 text-xs text-white/40">
          <p>
            Impersonation is privileged and disclosed in our legal terms. Sign out and clear sessions when finished.
            Prefer sandbox Stripe keys on staging.
          </p>
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
