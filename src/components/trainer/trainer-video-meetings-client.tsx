"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainerVirtualMeetingSettings } from "@/lib/trainer-virtual-meeting-settings";

type PlatformRow = {
  key: "GOOGLE" | "ZOOM" | "MICROSOFT";
  label: string;
  connected: boolean;
  hint: string | null;
};

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

type Summary = {
  prefs: TrainerVirtualMeetingSettings;
  platforms: PlatformRow[];
  upcomingVirtual: MeetingRow[];
  upcomingVirtualTotal: number;
  pastVirtual: MeetingRow[];
};

function datetimeLocalToIso(s: string): string | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function addMinutesIso(isoStart: string, mins: number): string {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

const OAUTH: Record<PlatformRow["key"], { startPath: string; connectLabel: string }> = {
  GOOGLE: { startPath: "/api/trainer/oauth/google/start", connectLabel: "CONNECT TO GOOGLE MEET" },
  ZOOM: { startPath: "/api/trainer/oauth/zoom/start", connectLabel: "CONNECT TO ZOOM" },
  MICROSOFT: { startPath: "/api/trainer/oauth/microsoft/start", connectLabel: "CONNECT TO MICROSOFT TEAMS" },
};

export function TrainerVideoMeetingsClient() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [clients, setClients] = useState<{ clientUsername: string; displayName: string }[]>([]);
  const [clientsErr, setClientsErr] = useState<string | null>(null);

  const [scheduleClient, setScheduleClient] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [schedulePlatform, setSchedulePlatform] = useState<"" | PlatformRow["key"]>("");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleErr, setScheduleErr] = useState<string | null>(null);
  const [scheduleOk, setScheduleOk] = useState<string | null>(null);

  const [prefsDraft, setPrefsDraft] = useState<TrainerVirtualMeetingSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [settingsOk, setSettingsOk] = useState(false);

  const [showPastBlock, setShowPastBlock] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState<string | null>(null);
  const [virtualMeetingSettingsOpen, setVirtualMeetingSettingsOpen] = useState(false);

  const banner = useMemo(() => {
    const c = searchParams.get("connected");
    if (c === "google") return "Google Calendar / Meet is connected.";
    if (c === "zoom") return "Zoom is connected.";
    if (c === "microsoft") return "Microsoft Teams is connected.";
    if (searchParams.get("oauthError")) return `Connection issue: ${searchParams.get("oauthError")}`;
    return null;
  }, [searchParams]);

  const loadSummary = useCallback(async () => {
    setSummaryErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/virtual-meetings/summary");
      const data = (await res.json()) as Summary & { error?: string };
      if (!res.ok) {
        setSummaryErr(data.error ?? "Could not load virtual meetings.");
        return;
      }
      setSummary({
        prefs: data.prefs,
        platforms: data.platforms ?? [],
        upcomingVirtual: data.upcomingVirtual ?? [],
        upcomingVirtualTotal: data.upcomingVirtualTotal ?? 0,
        pastVirtual: data.pastVirtual ?? [],
      });
      setPrefsDraft(data.prefs);
    } catch {
      setSummaryErr("Network error.");
    }
  }, []);

  const loadClients = useCallback(async () => {
    setClientsErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/booking-invite-clients");
      const data = (await res.json()) as { clients?: { clientUsername: string; displayName: string }[]; error?: string };
      if (!res.ok) {
        setClientsErr(data.error ?? "Could not load clients.");
        return;
      }
      setClients(data.clients ?? []);
    } catch {
      setClientsErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadClients();
  }, [loadSummary, loadClients]);

  function applyDefaultEndFromStart(startLocal: string) {
    const mins = summary?.prefs?.defaultDurationMins ?? 60;
    const sIso = datetimeLocalToIso(startLocal);
    if (!sIso) return;
    const endIso = addMinutesIso(sIso, mins);
    const localEnd = new Date(endIso);
    const pad = (n: number) => String(n).padStart(2, "0");
    setScheduleEnd(
      `${localEnd.getFullYear()}-${pad(localEnd.getMonth() + 1)}-${pad(localEnd.getDate())}T${pad(localEnd.getHours())}:${pad(localEnd.getMinutes())}`,
    );
  }

  async function submitQuickSchedule() {
    setScheduleErr(null);
    setScheduleOk(null);
    if (!scheduleClient.trim()) {
      setScheduleErr("Choose a client.");
      return;
    }
    const s = datetimeLocalToIso(scheduleStart);
    const e = datetimeLocalToIso(scheduleEnd);
    if (!s || !e || new Date(e) <= new Date(s)) {
      setScheduleErr("Enter a valid start and end (end after start).");
      return;
    }
    let platformKey: PlatformRow["key"] | undefined = schedulePlatform || undefined;
    if (platformKey) {
      const hit = summary?.platforms.find((p) => p.key === platformKey);
      if (!hit?.connected) {
        setScheduleErr("That platform is not connected yet.");
        return;
      }
    } else if (summary?.prefs?.preferredSyncPlatform) {
      const hit = summary.platforms.find((p) => p.key === summary.prefs.preferredSyncPlatform && p.connected);
      if (hit) platformKey = hit.key;
    }
    setScheduleBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/virtual-meetings/quick-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUsername: scheduleClient.trim(),
          startsAt: s,
          endsAt: e,
          note: scheduleNote.trim() || undefined,
          platform: platformKey,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; videoWarning?: string | null; error?: string };
      if (!res.ok) {
        setScheduleErr(data.error ?? "Could not schedule.");
        return;
      }
      setScheduleOk(
        data.videoWarning
          ? `Invite sent. ${data.videoWarning}`
          : "Virtual meeting invite sent to chat. Once the client confirms, it appears in your schedule.",
      );
      setScheduleNote("");
      void loadSummary();
    } finally {
      setScheduleBusy(false);
    }
  }

  async function saveVirtualMeetingSettings() {
    if (!prefsDraft) return;
    setSettingsErr(null);
    setSettingsOk(false);
    setSettingsBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/virtual-meeting-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefsDraft),
      });
      const data = (await res.json()) as { prefs?: TrainerVirtualMeetingSettings; error?: string };
      if (!res.ok) {
        setSettingsErr(data.error ?? "Could not save.");
        return;
      }
      if (data.prefs) setPrefsDraft(data.prefs);
      setSettingsOk(true);
      void loadSummary();
    } finally {
      setSettingsBusy(false);
    }
  }

  async function disconnect(provider: string) {
    if (!window.confirm(`Disconnect ${provider}?`)) return;
    setDisconnectBusy(provider);
    setSummaryErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/video-connections/${encodeURIComponent(provider)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSummaryErr(data.error ?? "Could not disconnect.");
        return;
      }
      void loadSummary();
    } finally {
      setDisconnectBusy(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const connectPlatforms: PlatformRow[] = (["GOOGLE", "ZOOM", "MICROSOFT"] as const).map((key) => {
    const hit = summary?.platforms.find((p) => p.key === key);
    if (hit) return hit;
    const label = key === "GOOGLE" ? "Google Meet" : key === "ZOOM" ? "Zoom" : "Microsoft Teams";
    return { key, label, connected: false, hint: null };
  });

  return (
    <div className="space-y-8">
      {banner ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            searchParams.get("oauthError")
              ? "border-amber-500/35 bg-amber-500/10 text-amber-100/90"
              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100/90"
          }`}
        >
          {banner}
        </p>
      ) : null}
      {summaryErr ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{summaryErr}</p> : null}

      {/* 1 — Schedule (first bubble) */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-white">Schedule a Virtual Meeting</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Pick a paid client, window, and optional platform. We send a <span className="text-white/70">virtual</span> booking invite to
          your chat thread; when they confirm, it shows on your{" "}
          <Link href="/trainer/dashboard/bookings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
            Booking Calendar
          </Link>
          .
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-[11px] text-white/55">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Platforms</p>
          <ul className="mt-2 space-y-1.5">
            {connectPlatforms.map((p) => (
              <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-white/80">{p.label}</span>
                <span className={p.connected ? "text-emerald-200/80" : "text-amber-200/85"}>
                  {p.connected ? (p.hint ? `Connected · ${p.hint}` : "Connected") : "(NOT CONNECTED)"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {clientsErr ? <p className="mt-3 text-xs text-amber-200/90">{clientsErr}</p> : null}
        {scheduleErr ? <p className="mt-3 text-xs text-red-200/90">{scheduleErr}</p> : null}
        {scheduleOk ? <p className="mt-3 text-xs text-emerald-200/90">{scheduleOk}</p> : null}
        <div className="mt-4 space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Client</label>
          <select
            value={scheduleClient}
            onChange={(e) => setScheduleClient(e.target.value)}
            className="w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
          >
            <option value="">Select…</option>
            {clients.map((c) => (
              <option key={c.clientUsername} value={c.clientUsername}>
                {c.displayName} (@{c.clientUsername})
              </option>
            ))}
          </select>
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Start</label>
          <input
            type="datetime-local"
            value={scheduleStart}
            onChange={(e) => {
              const v = e.target.value;
              setScheduleStart(v);
              if (v) applyDefaultEndFromStart(v);
            }}
            className="w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
          />
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">End</label>
          <input
            type="datetime-local"
            value={scheduleEnd}
            onChange={(e) => setScheduleEnd(e.target.value)}
            className="w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
          />
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">OAuth platform (optional)</label>
          <p className="text-[10px] text-white/40">If selected, we try to create a meeting link on that provider after the invite is sent.</p>
          <div className="flex flex-wrap gap-2">
            {(["GOOGLE", "ZOOM", "MICROSOFT"] as const).map((k) => {
              const p = connectPlatforms.find((x) => x.key === k);
              const connected = p?.connected ?? false;
              const label = k === "GOOGLE" ? "Google Meet" : k === "ZOOM" ? "Zoom" : "Teams";
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!connected}
                  onClick={() => setSchedulePlatform((cur) => (cur === k ? "" : k))}
                  title={!connected ? "Connect this provider below first." : undefined}
                  className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-35 ${
                    schedulePlatform === k ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-white/12 text-white/60 hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Note (optional)</label>
          <input
            value={scheduleNote}
            onChange={(e) => setScheduleNote(e.target.value)}
            maxLength={500}
            className="w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={scheduleBusy}
            onClick={() => void submitQuickSchedule()}
            className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/14 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-emerald-100 disabled:opacity-40"
          >
            {scheduleBusy ? "Sending…" : "Send virtual invite"}
          </button>
        </div>
      </section>

      {/* 2 — Upcoming schedule */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-white">Virtual Meeting Schedule</h2>
          {(summary?.upcomingVirtualTotal ?? 0) > 4 ? (
            <Link
              href="/trainer/dashboard/video-meetings/all?scope=upcoming"
              className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FF9A4A] underline-offset-2 hover:underline"
            >
              MORE
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-white/50">Next upcoming virtual sessions (confirmed or pending with a future start).</p>
        <ul className="mt-4 space-y-2">
          {(summary?.upcomingVirtual ?? []).length === 0 ? (
            <li className="text-sm text-white/45">No upcoming virtual meetings in this window.</li>
          ) : (
            (summary?.upcomingVirtual ?? []).map((m) => (
              <li key={m.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-white/90">{m.clientLabel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{m.status.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  {new Date(m.startsAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
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
                ) : (
                  <p className="mt-2 text-[10px] text-white/38">No join link yet — add from chat after the client confirms.</p>
                )}
              </li>
            ))
          )}
        </ul>
        <div className="mt-6 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={() => setShowPastBlock((v) => !v)}
            className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF9A4A] underline-offset-2 hover:underline"
          >
            {showPastBlock ? "Hide past meetings" : "See all past meetings"}
          </button>
          {showPastBlock ? (
            <ul className="mt-3 space-y-2">
              {(summary?.pastVirtual ?? []).length === 0 ? (
                <li className="text-xs text-white/45">No past virtual meetings loaded yet.</li>
              ) : (
                <>
                  {(summary?.pastVirtual ?? []).map((m) => (
                    <li key={m.id} className="rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2 text-xs text-white/70">
                      <span className="font-semibold text-white/85">{m.clientLabel}</span> ·{" "}
                      {new Date(m.startsAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </li>
                  ))}
                  <li className="pt-2">
                    <Link
                      href="/trainer/dashboard/video-meetings/all?scope=past"
                      className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FF9A4A] underline-offset-2 hover:underline"
                    >
                      View full past list
                    </Link>
                  </li>
                </>
              )}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Bottom — centered Virtual Meeting Settings (collapsible) */}
      <div className="flex justify-center">
        <section className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0d1018]/95 p-5 text-center sm:p-7">
          <button
            type="button"
            onClick={() => setVirtualMeetingSettingsOpen((o) => !o)}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-center transition hover:border-white/[0.12] hover:bg-white/[0.05]"
            aria-expanded={virtualMeetingSettingsOpen}
          >
            <h2 className="text-lg font-black tracking-tight text-white">Virtual Meeting Settings</h2>
            <span className="text-xs font-bold text-[#FF9A4A] transition group-hover:text-[#ffb066]">
              {virtualMeetingSettingsOpen ? "▴ Hide" : "▾ Show"}
            </span>
          </button>
          {!virtualMeetingSettingsOpen ? (
            <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-white/40">
              OAuth providers, callback URLs, connect/disconnect, and session preferences.
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-white/45">
              OAuth redirect URLs must be allow-listed as{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[10px] text-white/70">
                {origin || "(your origin)"}/api/trainer/oauth/&lt;provider&gt;/callback
              </code>
              .
            </p>
          )}

          {virtualMeetingSettingsOpen ? (
            <>
          <h3 className="mt-8 text-sm font-bold tracking-tight text-white">Connect Providers</h3>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-white/45">
            Link the platforms you use for virtual sessions. Refresh tokens are stored encrypted (AES-256-GCM).
          </p>
          <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3">
            {connectPlatforms.map((p) => {
              const o = OAUTH[p.key];
              return (
                <div key={p.key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                  {p.connected ? (
                    <div className="space-y-3 text-left">
                      <p className="text-xs font-semibold text-white/85">{p.label}</p>
                      {p.hint ? <p className="text-[10px] text-white/45">Linked: {p.hint}</p> : <p className="text-[10px] text-emerald-200/70">Connected</p>}
                      <button
                        type="button"
                        disabled={disconnectBusy === p.key}
                        onClick={() => void disconnect(p.key)}
                        className="w-full rounded-xl border border-white/15 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:border-red-400/40 hover:text-red-100/90 disabled:opacity-40"
                      >
                        {disconnectBusy === p.key ? "…" : "Disconnect"}
                      </button>
                    </div>
                  ) : (
                    <a
                      href={o.startPath}
                      className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/14 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-white transition hover:border-[#FF7E00]/65"
                    >
                      {o.connectLabel}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {prefsDraft ? (
            <div className="mx-auto mt-10 max-w-md space-y-4 border-t border-white/[0.08] pt-8 text-left">
              <h3 className="text-center text-sm font-bold tracking-tight text-white">Preferences</h3>
              {settingsErr ? <p className="text-center text-xs text-red-200/90">{settingsErr}</p> : null}
              {settingsOk ? <p className="text-center text-xs text-emerald-200/90">Saved.</p> : null}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Default session length (minutes)</label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={prefsDraft.defaultDurationMins ?? 60}
                  onChange={(e) =>
                    setPrefsDraft((d) =>
                      d ? { ...d, defaultDurationMins: Math.min(240, Math.max(15, parseInt(e.target.value, 10) || 60)) } : d,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
                />
                <p className="mt-1 text-[10px] text-white/38">Used when we pre-fill the end time on this page.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Preferred OAuth platform</label>
                <select
                  value={prefsDraft.preferredSyncPlatform ?? ""}
                  onChange={(e) =>
                    setPrefsDraft((d) => {
                      if (!d) return d;
                      const v = e.target.value;
                      return { ...d, preferredSyncPlatform: v === "" ? null : (v as "GOOGLE" | "ZOOM" | "MICROSOFT") };
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
                >
                  <option value="">No default</option>
                  <option value="GOOGLE">Google Meet</option>
                  <option value="ZOOM">Zoom</option>
                  <option value="MICROSOFT">Microsoft Teams</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <input
                  type="checkbox"
                  checked={Boolean(prefsDraft.remindFiveMinutesBefore)}
                  onChange={(e) => setPrefsDraft((d) => (d ? { ...d, remindFiveMinutesBefore: e.target.checked } : d))}
                  className="mt-1 rounded border-white/20 bg-[#0E1016]"
                />
                <span>
                  <span className="text-sm font-semibold text-white/90">Five-minute reminder</span>
                  <span className="mt-1 block text-xs text-white/45">We&apos;ll use this preference as calendar integrations expand.</span>
                </span>
              </label>
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={settingsBusy}
                  onClick={() => void saveVirtualMeetingSettings()}
                  className="rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/18 px-8 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-40"
                >
                  {settingsBusy ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
