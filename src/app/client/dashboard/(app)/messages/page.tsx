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
  archived?: boolean;
  canRevive?: boolean;
  archiveExpiresAt?: string | null;
};

export default function ClientChatsHubPage() {
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [activeThreads, setActiveThreads] = useState<Thread[] | null>(null);
  const [archivedThreads, setArchivedThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/chats");
        const data = (await res.json()) as {
          activeThreads?: Thread[];
          archivedThreads?: Thread[];
          threads?: Thread[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load chats.");
          return;
        }
        if (data.activeThreads != null && data.archivedThreads != null) {
          setActiveThreads(data.activeThreads);
          setArchivedThreads(data.archivedThreads);
        } else {
          setActiveThreads(data.threads ?? []);
          setArchivedThreads([]);
        }
      } catch {
        if (!cancelled) setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const threads = tab === "active" ? activeThreads : archivedThreads;

  async function revive(username: string) {
    setError(null);
    const res = await fetch(`/api/client/conversations/${encodeURIComponent(username)}/revive`, { method: "POST" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not revive.");
      return;
    }
    window.location.href = `/client/messages/${encodeURIComponent(username)}`;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Inbox</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Chats</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Active threads, plus Archives for chats you or your coach ended. Archived threads are deleted automatically
          after 90 days unless the person who ended them revives the match.
        </p>
      </header>

      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] ${
            tab === "active"
              ? "border border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
              : "border border-white/10 bg-white/[0.04] text-white/55"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setTab("archive")}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] ${
            tab === "archive"
              ? "border border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
              : "border border-white/10 bg-white/[0.04] text-white/55"
          }`}
        >
          Archives (90 days)
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          {error}
        </p>
      ) : null}

      {threads === null ? (
        <p className="text-center text-sm text-white/45">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center text-sm text-white/50">
          <p>{tab === "active" ? "No conversations yet." : "No archived threads."}</p>
          {tab === "active" ? (
            <p className="mt-4">
              <Link
                href="/client/dashboard/find-trainers"
                className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
              >
                Find Coaches
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => {
            const profileHref = `/trainers/${encodeURIComponent(t.trainerUsername)}`;
            return (
              <li key={`${tab}-${t.trainerUsername}`}>
                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 px-4 py-3 transition hover:border-[#FF7E00]/30">
                  <Link href={t.href} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1016]">
                    {t.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                        {t.displayName.charAt(0)}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 text-left">
                    <Link href={t.href} className="block truncate text-sm font-semibold text-white/90 hover:underline">
                      {t.displayName}
                    </Link>
                    <Link
                      href={profileHref}
                      className="mt-0.5 inline-block text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                    >
                      @{t.trainerUsername}
                    </Link>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {tab === "archive" ? (
                        <>
                          Archived
                          {t.archiveExpiresAt
                            ? ` · Removes ${new Date(t.archiveExpiresAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}`
                            : ""}
                        </>
                      ) : (
                        <>
                          {t.source === "nudge" ? "Nudged you" : t.source === "saved" ? "You saved" : "Thread"} ·{" "}
                          {t.chatOpen ? "Chat live" : "Chat pending"} ·{" "}
                          {new Date(t.lastActivityAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </>
                      )}
                    </p>
                    {tab === "archive" && t.canRevive ? (
                      <button
                        type="button"
                        onClick={() => void revive(t.trainerUsername)}
                        className="mt-2 inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100/90"
                      >
                        Revive chat
                      </button>
                    ) : null}
                  </div>
                  <Link href={t.href} className="shrink-0 text-white/35 hover:text-white/55" aria-label={`Open chat with ${t.displayName}`}>
                    →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
