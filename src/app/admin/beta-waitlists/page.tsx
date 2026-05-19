"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Entry = {
  id: string;
  createdAt: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  desiredUsername: string;
  serviceZipCode?: string;
  homeZipCode?: string;
  invitedAt: string | null;
  slotExpiresAt: string | null;
};

type CapStatus = {
  gatesEnabled?: boolean;
  trainerCap?: number;
  clientCap?: number;
  trainerCount?: number;
  clientCount?: number;
};

function statusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "INVITED") return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
  if (s === "QUEUED") return "border-white/15 bg-white/[0.06] text-white/75";
  if (s === "REGISTERED") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (s === "EXPIRED" || s === "CANCELLED") return "border-white/10 bg-white/[0.03] text-white/45";
  return "border-white/15 bg-white/[0.06] text-white/70";
}

export default function AdminBetaWaitlistsPage() {
  const [trainers, setTrainers] = useState<Entry[] | null>(null);
  const [clients, setClients] = useState<Entry[] | null>(null);
  const [caps, setCaps] = useState<CapStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [tr, cl, st] = await Promise.all([
        fetch("/api/admin/beta-waitlist/trainers", { credentials: "include" }),
        fetch("/api/admin/beta-waitlist/clients", { credentials: "include" }),
        fetch("/api/public/beta-launch-status"),
      ]);
      const tj = (await tr.json()) as { entries?: Entry[]; error?: string };
      const cj = (await cl.json()) as { entries?: Entry[]; error?: string };
      const capsJson = (await st.json()) as CapStatus;
      if (!tr.ok) {
        setError(tj.error ?? "Could not load trainer waitlist.");
        return;
      }
      if (!cl.ok) {
        setError(cj.error ?? "Could not load client waitlist.");
        return;
      }
      setTrainers(tj.entries ?? []);
      setClients(cj.entries ?? []);
      setCaps(capsJson);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial admin list load */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] px-5 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.08),transparent_60%)]"
      />
      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/85">Match Fit</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Beta waitlists</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Separate trainer and client queues. Promotion runs on the 15-minute cron and when accounts are removed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load()}
              className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/80 hover:border-white/25 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/admin" className="text-sm text-cyan-300/90 hover:underline">
              ← Admin home
            </Link>
          </div>
        </header>

        {caps?.gatesEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Trainers</p>
              <p className="mt-1 text-lg font-black text-white">
                {caps.trainerCount ?? "—"} / {caps.trainerCap ?? "—"} active
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Clients</p>
              <p className="mt-1 text-lg font-black text-white">
                {caps.clientCount ?? "—"} / {caps.clientCap ?? "—"} active
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Beta gates are off in this environment (`MATCH_FIT_BETA_GATES_ENABLED` not set).
          </p>
        )}

        {error ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
        ) : null}

        <WaitlistSection title="Trainer waitlist" entries={trainers} zipKey="serviceZipCode" />
        <WaitlistSection title="Client waitlist" entries={clients} zipKey="homeZipCode" />
      </div>
    </main>
  );
}

function WaitlistSection({
  title,
  entries,
  zipKey,
}: {
  title: string;
  entries: Entry[] | null;
  zipKey: "serviceZipCode" | "homeZipCode";
}) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#0c0f14]/90 p-5 sm:p-6">
      <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">{title}</h2>
      <div className="mt-4 space-y-2">
        {!entries ? (
          <p className="text-sm text-white/45">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-white/45">No entries.</p>
        ) : (
          entries.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[#080a0e]/80 px-3 py-2.5 text-sm"
            >
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(r.status)}`}>
                {r.status}
              </span>
              <span className="font-semibold text-white/90">@{r.desiredUsername}</span>
              <span className="text-white/50">{r.email}</span>
              <span className="text-white/40">ZIP {r[zipKey] ?? "—"}</span>
              {r.slotExpiresAt ? (
                <span className="text-[11px] text-white/35">
                  slot until {new Date(r.slotExpiresAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
