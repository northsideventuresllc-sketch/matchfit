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
};

const STAGE_LABEL: Record<string, string> = {
  POTENTIAL_CLIENT: "Potential client",
  LEAD: "Lead",
  FIRST_TIME_CLIENT: "First-time client",
  REGULAR_CLIENT: "Regular client",
  FORMER_CLIENT: "Former client",
};

export function TrainerChatsHubClient() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trainer/conversations");
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
      <p className="mx-auto max-w-xl text-center text-sm text-white/50">
        Threads appear after you accept a client inquiry or send a discovery nudge. Label each relationship so your
        pipeline stays organized.
      </p>
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
          <p className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/trainer/dashboard/interests" className="text-[#FF7E00] font-semibold underline-offset-2 hover:underline">
              Inquiries
            </Link>
            <span className="text-white/25">·</span>
            <Link href="/trainer/dashboard/discover-clients" className="text-[#FF7E00] font-semibold underline-offset-2 hover:underline">
              Discover Clients
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.clientUsername}>
              <Link
                href={`/trainer/dashboard/messages/${encodeURIComponent(t.clientUsername)}`}
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
                  <p className="text-xs text-white/45">@{t.clientUsername}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                    {STAGE_LABEL[t.relationshipStage] ?? t.relationshipStage}
                    {!t.officialChatStartedAt ? " · Pending open" : ""}
                    {t.lastMessagePreview ? ` · ${t.lastMessagePreview}` : ""}
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
