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

export default function AdminBetaWaitlistsPage() {
  const [trainers, setTrainers] = useState<Entry[] | null>(null);
  const [clients, setClients] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [tr, cl] = await Promise.all([
      fetch("/api/admin/beta-waitlist/trainers", { credentials: "include" }),
      fetch("/api/admin/beta-waitlist/clients", { credentials: "include" }),
    ]);
    const tj = (await tr.json()) as { entries?: Entry[]; error?: string };
    const cj = (await cl.json()) as { entries?: Entry[]; error?: string };
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
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial admin list load */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <main className="min-h-dvh bg-[#050608] px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/85">Match Fit</p>
            <h1 className="mt-1 text-2xl font-black">Beta waitlists</h1>
            <p className="mt-2 text-sm text-white/55">Trainer and client queues are listed separately.</p>
          </div>
          <Link href="/admin" className="text-sm text-cyan-300/90 hover:underline">
            ← Admin home
          </Link>
        </header>
        {error ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
        ) : null}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Trainer waitlist</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(trainers ?? []).length === 0 ? (
              <p className="text-white/45">No entries.</p>
            ) : (
              trainers!.map((r) => (
                <div key={r.id} className="rounded-lg border border-white/[0.06] px-3 py-2 font-mono text-xs text-white/70">
                  {r.status} · @{r.desiredUsername} · {r.email} · ZIP {r.serviceZipCode ?? "—"}
                </div>
              ))
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Client waitlist</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(clients ?? []).length === 0 ? (
              <p className="text-white/45">No entries.</p>
            ) : (
              clients!.map((r) => (
                <div key={r.id} className="rounded-lg border border-white/[0.06] px-3 py-2 font-mono text-xs text-white/70">
                  {r.status} · @{r.desiredUsername} · {r.email} · ZIP {r.homeZipCode ?? "—"}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
