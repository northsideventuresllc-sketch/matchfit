"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MeetingRow = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  videoConferenceJoinUrl: string | null;
  videoConferenceProvider: string | null;
  clientUsername: string;
  clientLabel: string;
};

export function TrainerVirtualMeetingsAllClient() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") === "past" ? "past" : "upcoming";
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/virtual-meetings/list?scope=${scope}&limit=100`);
      const data = (await res.json()) as { meetings?: MeetingRow[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load.");
        return;
      }
      setMeetings(data.meetings ?? []);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/trainer/dashboard/video-meetings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
          ← Virtual Meetings
        </Link>
        <span className="text-white/25">|</span>
        <Link
          href="/trainer/dashboard/video-meetings/all?scope=upcoming"
          className={scope === "upcoming" ? "font-bold text-white" : "text-white/55 hover:text-white/80"}
        >
          Upcoming
        </Link>
        <Link
          href="/trainer/dashboard/video-meetings/all?scope=past"
          className={scope === "past" ? "font-bold text-white" : "text-white/55 hover:text-white/80"}
        >
          Past
        </Link>
      </div>

      {err ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{err}</p> : null}
      {busy ? <p className="text-sm text-white/45">Loading…</p> : null}
      {!busy && !err ? (
        <ul className="space-y-2">
          {meetings.length === 0 ? (
            <li className="text-sm text-white/45">No meetings in this list.</li>
          ) : (
            meetings.map((m) => (
              <li key={m.id} className="rounded-xl border border-white/[0.08] bg-[#10131c]/90 px-4 py-3 text-sm text-white/80">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-white/92">{m.clientLabel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{m.status.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  {new Date(m.startsAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {m.endsAt ? ` – ${new Date(m.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
                </p>
                {m.videoConferenceJoinUrl ? (
                  <a
                    href={m.videoConferenceJoinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[10px] font-black uppercase tracking-[0.1em] text-indigo-200/90 underline-offset-2 hover:underline"
                  >
                    Open join link
                  </a>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
