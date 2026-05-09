"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Row =
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

function AdminDirectoryUserTable(props: {
  title: string;
  kind: "client" | "trainer";
  list: Row[];
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
                {props.busyKey === `${props.kind}:${row.id}` ? "Opening…" : `Open as ${props.kind}`}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function AdminDashboardClient(props: {
  initialStats: { clientCount: number; trainerCount: number };
  initialTestMode: boolean;
}) {
  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<{ clients: Row[]; trainers: Row[] } | null>(null);
  const [testMode, setTestMode] = useState(props.initialTestMode);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const load = useCallback(async (query: string) => {
    const url = new URL("/api/admin/users", window.location.origin);
    url.searchParams.set("role", "both");
    if (query.trim()) url.searchParams.set("q", query.trim());
    const res = await fetch(url.toString(), { credentials: "include" });
    const data = (await res.json()) as { clients?: Row[]; trainers?: Row[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load directory.");
      return;
    }
    setRows({ clients: data.clients ?? [], trainers: data.trainers ?? [] });
    setError(null);
  }, []);

  /* Async fetches; state updates only after await (not synchronous in the effect body). */
  /* eslint-disable react-hooks/set-state-in-effect -- directory loads */
  useEffect(() => {
    void load("");
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(q), 280);
    return () => window.clearTimeout(t);
  }, [q, load]);
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
        setError("Complete the security check before opening a member session.");
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

      <div className="relative mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/85">Match Fit</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Administrator Portal</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              <span className="mb-3 block rounded-xl border border-amber-400/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-50/95 sm:text-sm">
                <span className="font-semibold text-amber-100">First beta.</span> The Administrator Portal is not yet final in this
                release; complete administrative tooling will be rolled in when Match Fit version 1.0 launches. Until then, capabilities
                here may be partial or change as we prepare for go-live.
              </span>
              Search clients and trainers, then open their dashboards in a secure impersonation session. Use{" "}
              <strong className="text-white/80">test mode</strong> as a visible reminder while you exercise product flows; it does not
              disable Stripe or other third parties unless those environments are already in sandbox.
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

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Active clients</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{props.initialStats.clientCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Active trainers</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{props.initialStats.trainerCount}</p>
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

        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Search username, email, or phone</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="rounded-xl border border-white/[0.1] bg-[#07080c] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/20"
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

        <footer className="border-t border-white/[0.08] pt-6 text-xs text-white/40">
          <p>
            Prefer sandbox Stripe keys and Twilio test credentials on staging. Production impersonation is privileged: sign out and
            clear sessions when finished.
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
