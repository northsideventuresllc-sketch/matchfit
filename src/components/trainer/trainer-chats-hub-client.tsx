"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Thread = {
  clientUsername: string;
  displayName: string;
  profileImageUrl: string | null;
  relationshipStage: string;
  officialChatStartedAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  archived?: boolean;
  canRevive?: boolean;
  archiveExpiresAt?: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  POTENTIAL_CLIENT: "Potential client",
  LEAD: "Lead",
  FIRST_TIME_CLIENT: "First-time client",
  REGULAR_CLIENT: "Regular client",
  FORMER_CLIENT: "Former client",
};

export function TrainerChatsHubClient() {
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [activeThreads, setActiveThreads] = useState<Thread[] | null>(null);
  const [archivedThreads, setArchivedThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trainer/conversations");
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

  async function revive(clientUsername: string) {
    setError(null);
    const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(clientUsername)}/revive`, {
      method: "POST",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not revive.");
      return;
    }
    window.location.href = `/trainer/dashboard/messages/${encodeURIComponent(clientUsername)}`;
  }

  return (
    <div className="space-y-8">
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
            <p className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/trainer/dashboard/interests" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                Inquiries
              </Link>
              <span className="text-white/25">·</span>
              <Link href="/trainer/dashboard/discover-clients" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                Discover Clients
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={`${tab}-${t.clientUsername}`}>
              <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 px-4 py-3 transition hover:border-[#FF7E00]/30">
                <Link
                  href={`/trainer/dashboard/messages/${encodeURIComponent(t.clientUsername)}`}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1016]"
                >
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
                  <Link
                    href={`/trainer/dashboard/messages/${encodeURIComponent(t.clientUsername)}`}
                    className="block truncate text-sm font-semibold text-white/90 hover:underline"
                  >
                    {t.displayName}
                  </Link>
                  <p className="text-xs text-white/45">@{t.clientUsername}</p>
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
                        {STAGE_LABEL[t.relationshipStage] ?? t.relationshipStage}
                        {!t.officialChatStartedAt ? " · Pending open" : ""}
                        {t.lastMessagePreview ? ` · ${t.lastMessagePreview}` : ""}
                      </>
                    )}
                  </p>
                  {tab === "archive" && t.canRevive ? (
                    <button
                      type="button"
                      onClick={() => void revive(t.clientUsername)}
                      className="mt-2 inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100/90"
                    >
                      Revive chat
                    </button>
                  ) : null}
                </div>
                <Link
                  href={`/trainer/dashboard/messages/${encodeURIComponent(t.clientUsername)}`}
                  className="shrink-0 text-white/35 hover:text-white/55"
                  aria-hidden
                >
                  →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
