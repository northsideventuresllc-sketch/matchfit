"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Thread = {
  trainerUsername: string;
  displayName: string;
  profileImageUrl: string | null;
  href: string;
  source: "nudge" | "saved" | "conversation";
  lastActivityAt: string;
  chatOpen: boolean;
};

export default function ClientChatsHubPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/chats");
        const data = (await res.json()) as { threads?: Thread[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load chats.");
          return;
        }
        setThreads(data.threads ?? []);
      } catch {
        if (!cancelled) setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Inbox</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Chats</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Coaches you saved, coaches who nudged you, and active Match Fit threads appear here. Chats open after a coach
          accepts your interest or sends a nudge.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          {error}
        </p>
      ) : null}

      {threads === null ? (
        <p className="text-center text-sm text-white/45">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center text-sm text-white/50">
          <p>No conversations yet.</p>
          <p className="mt-4">
            <Link
              href="/client/dashboard/find-trainers"
              className="text-[#FF7E00] font-semibold underline-offset-2 hover:underline"
            >
              Find Coaches
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.trainerUsername}>
              <Link
                href={t.href}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 px-4 py-3 transition hover:border-[#FF7E00]/30"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1016]">
                  {t.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                      {t.displayName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-white/90">{t.displayName}</p>
                  <p className="text-xs text-white/45">@{t.trainerUsername}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                    {t.source === "nudge" ? "Nudged you" : t.source === "saved" ? "You saved" : "Thread"} ·{" "}
                    {t.chatOpen ? "Chat live" : "Chat pending"} ·{" "}
                    {new Date(t.lastActivityAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-white/35" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
