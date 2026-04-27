"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Interest = {
  clientUsername: string;
  displayName: string;
  profileImageUrl: string | null;
  zipCode: string;
  bio: string | null;
  interestedAt: string;
};

export function TrainerProfileInterestsClient() {
  const [rows, setRows] = useState<Interest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/profile-interests");
      const data = (await res.json()) as { interests?: Interest[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load inquiries.");
        setRows([]);
        return;
      }
      setRows(data.interests ?? []);
    } catch {
      setError("Network error.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function respond(clientUsername: string, decision: "ACCEPT" | "DECLINE") {
    setBusy(`${clientUsername}:${decision}`);
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/profile-interests/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUsername, decision }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update.");
        return;
      }
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="mx-auto max-w-xl text-center text-sm text-white/50">
        Clients who saved your profile or swiped interest appear here until you accept or decline. Accepting opens the
        official Match Fit chat thread.
      </p>
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          {error}
        </p>
      ) : null}
      {rows === null ? (
        <p className="text-center text-sm text-white/45">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center text-sm text-white/50">
          <p>No pending inquiries.</p>
          <p className="mt-4">
            <Link href="/trainer/dashboard/discover-clients" className="text-[#FF7E00] font-semibold underline-offset-2 hover:underline">
              Discover clients
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.clientUsername}
              className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1016]">
                  {r.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                      {r.displayName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white/90">{r.displayName}</p>
                  <p className="text-xs text-white/45">@{r.clientUsername}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Zip {r.zipCode} · {new Date(r.interestedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:w-52">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void respond(r.clientUsername, "ACCEPT")}
                  className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-xs font-black uppercase tracking-[0.1em] text-emerald-100 transition hover:border-emerald-500/50 disabled:opacity-40"
                >
                  {busy === `${r.clientUsername}:ACCEPT` ? "…" : "Accept inquiry"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void respond(r.clientUsername, "DECLINE")}
                  className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-xs font-black uppercase tracking-[0.1em] text-white/70 transition hover:border-white/25 disabled:opacity-40"
                >
                  {busy === `${r.clientUsername}:DECLINE` ? "…" : "Decline"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
