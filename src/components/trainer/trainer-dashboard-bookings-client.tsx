"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrainerBookingAvailability } from "@/lib/booking-availability";
import { defaultTrainerBookingAvailability } from "@/lib/booking-availability";
import {
  availabilityHitsForLocalDate,
  validateTrainerAvailabilityConsistency,
  type AvailabilityCalendarHit,
} from "@/lib/booking-availability-validate";
import { US_BOOKING_TIMEZONE_OPTIONS, normalizeUsBookingTimezone } from "@/lib/us-booking-timezones";

type BookingRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  inviteNote: string | null;
  sessionDelivery?: "IN_PERSON" | "VIRTUAL" | null;
  videoConferenceJoinUrl: string | null;
  videoConferenceProvider: string | null;
  clientUsername: string;
  clientLabel: string;
};

type VideoConn = { provider: string; hint: string | null };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const mm = parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

function calendarGridBounds(year: number, monthIndex: number): { gridStart: Date; gridEnd: Date } {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));
  gridEnd.setHours(23, 59, 59, 999);
  return { gridStart, gridEnd };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

function datetimeLocalToIso(s: string): string | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function providerCalendarLabel(provider: string): string {
  if (provider === "GOOGLE") return "Google Calendar";
  if (provider === "MICROSOFT") return "Outlook Calendar";
  if (provider === "ZOOM") return "Zoom";
  return provider;
}

export function TrainerDashboardBookingsClient() {
  const [timezone, setTimezone] = useState("America/New_York");
  const [doc, setDoc] = useState<TrainerBookingAvailability>(defaultTrainerBookingAvailability());
  const [guidelines, setGuidelines] = useState("");
  const [clientPublicSelfBookingEnabled, setClientPublicSelfBookingEnabled] = useState(false);
  /** Sun=0 … Sat=6 — multi-select for “add weekly window” */
  const [weeklyDaysSelected, setWeeklyDaysSelected] = useState<boolean[]>(() => [false, true, false, true, false, true, false]);
  const [weeklyStart, setWeeklyStart] = useState("09:00");
  const [weeklyEnd, setWeeklyEnd] = useState("12:00");
  const [blockDate, setBlockDate] = useState("");
  const [blockRepeatWeekly, setBlockRepeatWeekly] = useState(false);
  const [oneOffStart, setOneOffStart] = useState("");
  const [oneOffEnd, setOneOffEnd] = useState("");
  const [availabilityEditMode, setAvailabilityEditMode] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(() => new Date().getMonth());
  const [bookingsBusy, setBookingsBusy] = useState(false);
  const [connections, setConnections] = useState<VideoConn[]>([]);
  const [syncOpen, setSyncOpen] = useState(false);
  const syncRef = useRef<HTMLDivElement | null>(null);
  const bookingsFetchGen = useRef(0);
  const availabilityFetchGen = useRef(0);
  const [availabilityFetchErr, setAvailabilityFetchErr] = useState<string | null>(null);
  const [bookingsFetchErr, setBookingsFetchErr] = useState<string | null>(null);
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [availCalYear, setAvailCalYear] = useState(() => new Date().getFullYear());
  const [availCalMonthIndex, setAvailCalMonthIndex] = useState(() => new Date().getMonth());
  const [selectedAvailYmd, setSelectedAvailYmd] = useState<string | null>(null);
  const [settingsSaveBusy, setSettingsSaveBusy] = useState(false);
  const [availabilitySaveBusy, setAvailabilitySaveBusy] = useState(false);
  const [savedSettingsOk, setSavedSettingsOk] = useState(false);
  const [savedAvailabilityOk, setSavedAvailabilityOk] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClients, setInviteClients] = useState<{ clientUsername: string; displayName: string }[]>([]);
  const [inviteClient, setInviteClient] = useState("");
  const [inviteStart, setInviteStart] = useState("");
  const [inviteEnd, setInviteEnd] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteSessionDelivery, setInviteSessionDelivery] = useState<"IN_PERSON" | "VIRTUAL">("IN_PERSON");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [settingsSectionOpen, setSettingsSectionOpen] = useState(false);
  const [availabilityCalendarOpen, setAvailabilityCalendarOpen] = useState(true);

  const refreshBookings = useCallback(async () => {
    const { gridStart, gridEnd } = calendarGridBounds(calendarYear, calendarMonthIndex);
    const gen = ++bookingsFetchGen.current;
    setBookingsBusy(true);
    try {
      const res = await fetch(
        `/api/trainer/dashboard/bookings?from=${encodeURIComponent(gridStart.toISOString())}&to=${encodeURIComponent(gridEnd.toISOString())}`,
      );
      let data: { bookings?: BookingRow[]; error?: string } = {};
      try {
        data = (await res.json()) as { bookings?: BookingRow[]; error?: string };
      } catch {
        data = {};
      }
      if (gen !== bookingsFetchGen.current) return;
      if (!res.ok) {
        setBookingsFetchErr(data.error ?? "Could not load bookings.");
        return;
      }
      setBookings(data.bookings ?? []);
      setBookingsFetchErr(null);
    } catch {
      if (gen !== bookingsFetchGen.current) return;
      setBookings([]);
      setBookingsFetchErr(null);
    } finally {
      if (gen === bookingsFetchGen.current) setBookingsBusy(false);
    }
  }, [calendarYear, calendarMonthIndex]);

  const loadAvailability = useCallback(async () => {
    const gen = ++availabilityFetchGen.current;
    try {
      const res = await fetch("/api/trainer/dashboard/booking-availability", { cache: "no-store" });
      let data: {
        timezone?: string;
        document?: TrainerBookingAvailability;
        clientPublicSelfBookingEnabled?: boolean;
        error?: string;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }
      if (gen !== availabilityFetchGen.current) return;
      if (!res.ok) {
        if (res.status === 401) {
          setAvailabilityFetchErr(data.error ?? "Could not load availability.");
          return;
        }
        if (res.status === 404) {
          setDoc(defaultTrainerBookingAvailability());
          setGuidelines("");
          setAvailabilityFetchErr(null);
          return;
        }
        setAvailabilityFetchErr(data.error ?? "Could not load availability.");
        return;
      }
      if (data.timezone) setTimezone(normalizeUsBookingTimezone(data.timezone));
      if (typeof data.clientPublicSelfBookingEnabled === "boolean") {
        setClientPublicSelfBookingEnabled(data.clientPublicSelfBookingEnabled);
      }
      const merged = { ...defaultTrainerBookingAvailability(), ...(data.document ?? {}) };
      setDoc(merged);
      setGuidelines(merged.guidelinesText ?? "");
      setAvailabilityFetchErr(null);
    } catch {
      if (gen !== availabilityFetchGen.current) return;
      setDoc(defaultTrainerBookingAvailability());
      setAvailabilityFetchErr(null);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    const res = await fetch("/api/trainer/dashboard/video-connections");
    const data = (await res.json()) as { connections?: VideoConn[] };
    if (res.ok) setConnections(data.connections ?? []);
  }, []);

  const loadInviteClients = useCallback(async () => {
    const res = await fetch("/api/trainer/dashboard/booking-invite-clients");
    const data = (await res.json()) as { clients?: { clientUsername: string; displayName: string }[]; error?: string };
    if (!res.ok) {
      setActionErr(data.error ?? "Could not load clients for invites.");
      return;
    }
    setInviteClients(data.clients ?? []);
    setActionErr(null);
  }, []);

  useEffect(() => {
    void loadAvailability();
    void loadConnections();
  }, [loadAvailability, loadConnections]);

  useEffect(() => {
    void refreshBookings();
  }, [refreshBookings]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") void refreshBookings();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshBookings]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!syncRef.current?.contains(e.target as Node)) setSyncOpen(false);
    }
    if (syncOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [syncOpen]);

  const bookingsByDay = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const k = localDayKeyFromIso(b.startsAt);
      const arr = m.get(k) ?? [];
      arr.push(b);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return m;
  }, [bookings]);

  const calendarCells = useMemo(() => {
    const { gridStart, gridEnd } = calendarGridBounds(calendarYear, calendarMonthIndex);
    const cells: { date: Date; inMonth: boolean }[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      cells.push({
        date: new Date(cur),
        inMonth: cur.getMonth() === calendarMonthIndex && cur.getFullYear() === calendarYear,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [calendarYear, calendarMonthIndex]);

  function shiftCalendar(delta: number) {
    const d = new Date(calendarYear, calendarMonthIndex + delta, 1);
    setCalendarYear(d.getFullYear());
    setCalendarMonthIndex(d.getMonth());
  }

  function shiftAvailCalendar(delta: number) {
    const d = new Date(availCalYear, availCalMonthIndex + delta, 1);
    setAvailCalYear(d.getFullYear());
    setAvailCalMonthIndex(d.getMonth());
    setSelectedAvailYmd(null);
  }

  const availCalCells = useMemo(() => {
    const { gridStart, gridEnd } = calendarGridBounds(availCalYear, availCalMonthIndex);
    const cells: { date: Date; inMonth: boolean }[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      cells.push({
        date: new Date(cur),
        inMonth: cur.getMonth() === availCalMonthIndex && cur.getFullYear() === availCalYear,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [availCalYear, availCalMonthIndex]);

  function removeAvailabilityHit(hit: AvailabilityCalendarHit) {
    if (hit.kind === "weeklyPausedForDate") return;
    setValidationErr(null);
    setDoc((d) => {
      switch (hit.kind) {
        case "weekly":
          return { ...d, weeklyRules: (d.weeklyRules ?? []).filter((_, idx) => idx !== hit.index) };
        case "blackoutWeek":
          return {
            ...d,
            unavailableWeekdaysAllDay: (d.unavailableWeekdaysAllDay ?? []).filter((_, idx) => idx !== hit.index),
          };
        case "blackoutOnce":
          return { ...d, unavailableDatesOnce: (d.unavailableDatesOnce ?? []).filter((_, idx) => idx !== hit.index) };
        case "specific":
          return { ...d, specificSlots: (d.specificSlots ?? []).filter((_, idx) => idx !== hit.index) };
        default:
          return d;
      }
    });
  }

  async function saveBookingSettings() {
    setSettingsSaveBusy(true);
    setSavedSettingsOk(false);
    setActionErr(null);
    setValidationErr(null);
    try {
      const nextDoc: TrainerBookingAvailability = {
        ...doc,
        guidelinesText: guidelines.trim() || undefined,
      };
      const conflicts = validateTrainerAvailabilityConsistency(nextDoc);
      if (conflicts.length) {
        setValidationErr(conflicts.join(" "));
        return;
      }
      const res = await fetch("/api/trainer/dashboard/booking-availability", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: nextDoc,
          timezone: normalizeUsBookingTimezone(timezone),
          clientPublicSelfBookingEnabled,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionErr(data.error ?? "Save failed.");
        return;
      }
      setDoc(nextDoc);
      setSavedSettingsOk(true);
      setAvailabilityFetchErr(null);
      setBookingsFetchErr(null);
    } finally {
      setSettingsSaveBusy(false);
    }
  }

  async function saveAvailabilityBlocks() {
    setAvailabilitySaveBusy(true);
    setSavedAvailabilityOk(false);
    setActionErr(null);
    setValidationErr(null);
    const nextDoc: TrainerBookingAvailability = {
      ...doc,
      guidelinesText: guidelines.trim() || undefined,
    };
    const conflicts = validateTrainerAvailabilityConsistency(nextDoc);
    if (conflicts.length) {
      setValidationErr(conflicts.join(" "));
      setAvailabilitySaveBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/trainer/dashboard/booking-availability", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: nextDoc,
          timezone: normalizeUsBookingTimezone(timezone),
          clientPublicSelfBookingEnabled,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionErr(data.error ?? "Save failed.");
        return;
      }
      setDoc(nextDoc);
      setSavedAvailabilityOk(true);
      setAvailabilityEditMode(false);
      setSelectedAvailYmd(null);
      setAvailabilityFetchErr(null);
      setBookingsFetchErr(null);
      setValidationErr(null);
      setActionErr(null);
      await loadAvailability();
      setTimeout(() => {
        document.getElementById("trainer-bookings-availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } finally {
      setAvailabilitySaveBusy(false);
    }
  }

  function cancelAvailabilityEdit() {
    setAvailabilityEditMode(false);
    setValidationErr(null);
    setActionErr(null);
    setSelectedAvailYmd(null);
    void loadAvailability();
  }

  function toggleWeeklyDaySelect(dow: number) {
    setWeeklyDaysSelected((prev) => {
      const copy = [...prev];
      copy[dow] = !copy[dow];
      return copy;
    });
  }

  function addWeeklyRulesForSelectedDays() {
    const sm = timeToMinutes(weeklyStart);
    const em = timeToMinutes(weeklyEnd);
    if (sm == null || em == null || em <= sm) {
      setValidationErr("Weekly window: use times with end after start.");
      return;
    }
    const days = weeklyDaysSelected.map((on, dow) => (on ? dow : -1)).filter((d) => d >= 0);
    if (days.length === 0) {
      setValidationErr("Select at least one weekday (e.g. Mon / Wed / Fri).");
      return;
    }
    let nextRules = [...(doc.weeklyRules ?? [])];
    for (const dow of days) {
      const dup = nextRules.some((w) => w.dayOfWeek === dow && w.startMinutes === sm && w.endMinutes === em);
      if (dup) continue;
      nextRules = [...nextRules, { dayOfWeek: dow, startMinutes: sm, endMinutes: em }];
    }
    const next: TrainerBookingAvailability = { ...doc, weeklyRules: nextRules };
    const conflicts = validateTrainerAvailabilityConsistency(next);
    if (conflicts.length) {
      setValidationErr(conflicts.join(" "));
      return;
    }
    setValidationErr(null);
    setDoc(next);
    setWeeklyDaysSelected([false, false, false, false, false, false, false]);
  }

  function removeWeeklyRule(i: number) {
    setDoc((d) => ({
      ...d,
      weeklyRules: (d.weeklyRules ?? []).filter((_, idx) => idx !== i),
    }));
    setValidationErr(null);
  }

  function addBlackout() {
    const d = blockDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setValidationErr("Pick a valid date for blackout.");
      return;
    }
    let next: TrainerBookingAvailability;
    if (blockRepeatWeekly) {
      const dow = new Date(d + "T12:00:00").getDay();
      const cur = [...(doc.unavailableWeekdaysAllDay ?? [])];
      if (!cur.some((x) => x.dayOfWeek === dow)) cur.push({ dayOfWeek: dow });
      next = { ...doc, unavailableWeekdaysAllDay: cur };
    } else {
      const cur = [...(doc.unavailableDatesOnce ?? [])];
      if (!cur.some((x) => x.date === d)) cur.push({ date: d });
      next = { ...doc, unavailableDatesOnce: cur };
    }
    const conflicts = validateTrainerAvailabilityConsistency(next);
    if (conflicts.length) {
      setValidationErr(conflicts.join(" "));
      return;
    }
    setValidationErr(null);
    setDoc(next);
    setBlockDate("");
    setBlockRepeatWeekly(false);
  }

  function removeBlackoutOnce(i: number) {
    setDoc((d) => ({
      ...d,
      unavailableDatesOnce: (d.unavailableDatesOnce ?? []).filter((_, idx) => idx !== i),
    }));
    setValidationErr(null);
  }

  function removeBlackoutWeekly(i: number) {
    setDoc((d) => ({
      ...d,
      unavailableWeekdaysAllDay: (d.unavailableWeekdaysAllDay ?? []).filter((_, idx) => idx !== i),
    }));
    setValidationErr(null);
  }

  function addOneOffSlot() {
    const s = datetimeLocalToIso(oneOffStart);
    const e = datetimeLocalToIso(oneOffEnd);
    if (!s || !e || new Date(e) <= new Date(s)) {
      setValidationErr("One-off slot: choose start and end with end after start.");
      return;
    }
    const next: TrainerBookingAvailability = {
      ...doc,
      specificSlots: [...(doc.specificSlots ?? []), { startAt: s, endAt: e }],
    };
    const conflicts = validateTrainerAvailabilityConsistency(next);
    if (conflicts.length) {
      setValidationErr(conflicts.join(" "));
      return;
    }
    setValidationErr(null);
    setDoc(next);
    setOneOffStart("");
    setOneOffEnd("");
  }

  function removeOneOffSlot(i: number) {
    setDoc((d) => ({
      ...d,
      specificSlots: (d.specificSlots ?? []).filter((_, idx) => idx !== i),
    }));
    setValidationErr(null);
  }

  async function submitInvite() {
    if (!inviteClient.trim()) {
      setActionErr("Choose a client.");
      return;
    }
    const s = datetimeLocalToIso(inviteStart);
    const e = datetimeLocalToIso(inviteEnd);
    if (!s || !e || new Date(e) <= new Date(s)) {
      setActionErr("Invite: valid start and end required.");
      return;
    }
    setInviteBusy(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(inviteClient.trim())}/booking-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: s,
          endsAt: e,
          note: inviteNote.trim() || undefined,
          sessionDelivery: inviteSessionDelivery,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionErr(data.error ?? "Invite failed.");
        return;
      }
      setInviteOpen(false);
      setInviteNote("");
      setInviteStart("");
      setInviteEnd("");
      setInviteSessionDelivery("IN_PERSON");
      void refreshBookings();
    } finally {
      setInviteBusy(false);
    }
  }

  const calendarAccounts = useMemo(() => connections.filter((c) => c.provider === "GOOGLE" || c.provider === "MICROSOFT" || c.provider === "ZOOM"), [connections]);

  const selectedAvailHits = useMemo(() => {
    if (!selectedAvailYmd) return [];
    const parts = selectedAvailYmd.split("-").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return [];
    const dt = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
    return availabilityHitsForLocalDate(doc, selectedAvailYmd, dt.getDay());
  }, [doc, selectedAvailYmd]);

  return (
    <div className="space-y-10">
      {actionErr ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{actionErr}</p>
      ) : null}
      {validationErr ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/95">{validationErr}</p>
      ) : null}
      {availabilityFetchErr ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{availabilityFetchErr}</p>
      ) : null}
      {bookingsFetchErr ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-200/85">{bookingsFetchErr}</p>
      ) : null}

      {/* Availability — view / edit */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#10131c]/95 shadow-[0_0_0_1px_rgba(255,126,0,0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_10%_-20%,rgba(255,126,0,0.12),transparent_50%),radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(99,102,241,0.08),transparent_45%)]"
        />
        <div className="relative p-5 sm:p-7">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">My Availability</h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/50">
              What clients see on your profile stays high-level; here you shape the rhythm of your week.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {!availabilityEditMode ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.06] to-transparent p-4 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Preview</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.06] bg-[#0a0c11]/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF9A4A]/90">Weekly hours</p>
                      <ul className="mt-3 space-y-2 text-sm text-white/80">
                        {(doc.weeklyRules ?? []).length === 0 ? (
                          <li className="text-white/40">No weekly windows yet.</li>
                        ) : (
                          (doc.weeklyRules ?? []).map((r, i) => (
                            <li key={`w-${i}`} className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF7E00]" />
                              <span>
                                {DAYS_LONG[r.dayOfWeek]} · {formatMinutes(r.startMinutes)}–{formatMinutes(r.endMinutes)}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-[#0a0c11]/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300/90">One-off openings</p>
                      <ul className="mt-3 space-y-2 text-sm text-white/80">
                        {(doc.specificSlots ?? []).length === 0 ? (
                          <li className="text-white/40">None added.</li>
                        ) : (
                          (doc.specificSlots ?? []).map((s, i) => (
                            <li key={`s-${i}`} className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                              <span>
                                {new Date(s.startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} –{" "}
                                {new Date(s.endAt).toLocaleTimeString([], { timeStyle: "short" })}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-[#0a0c11]/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300/90">Blackouts</p>
                      <ul className="mt-3 space-y-2 text-sm text-white/80">
                        {(doc.unavailableWeekdaysAllDay ?? []).length === 0 && (doc.unavailableDatesOnce ?? []).length === 0 ? (
                          <li className="text-white/40">No blackout days.</li>
                        ) : (
                          <>
                            {(doc.unavailableWeekdaysAllDay ?? []).map((u, i) => (
                              <li key={`bw-${i}`} className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400/90" />
                                Every {DAYS_LONG[u.dayOfWeek]} (all day)
                              </li>
                            ))}
                            {(doc.unavailableDatesOnce ?? []).map((u, i) => (
                              <li key={`bd-${i}`} className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400/60" />
                                {u.date}
                              </li>
                            ))}
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {availabilityEditMode ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/[0.08] bg-[#0c0e14]/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Weekly recurring windows</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    Select one or more weekdays, set the time range, then add — e.g. Mon + Wed + Fri 9:00–12:00 in one step.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {DAYS.map((d, i) => (
                      <button
                        key={`wd-${d}`}
                        type="button"
                        onClick={() => toggleWeeklyDaySelect(i)}
                        className={`min-w-[2.5rem] rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                          weeklyDaysSelected[i]
                            ? "border-[#FF7E00]/55 bg-[#FF7E00]/20 text-white"
                            : "border-white/12 bg-[#0E1016] text-white/45 hover:border-white/20"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-white/50">
                      From
                      <input
                        type="time"
                        value={weeklyStart}
                        onChange={(e) => setWeeklyStart(e.target.value)}
                        className="ml-1 rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      To
                      <input
                        type="time"
                        value={weeklyEnd}
                        onChange={(e) => setWeeklyEnd(e.target.value)}
                        className="ml-1 rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addWeeklyRulesForSelectedDays}
                      className="rounded-lg border border-[#FF7E00]/45 bg-[#FF7E00]/18 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white"
                    >
                      Add window
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-white/70">
                    {(doc.weeklyRules ?? []).map((r, i) => (
                      <li key={`${r.dayOfWeek}-${r.startMinutes}-${i}`} className="flex items-center justify-between gap-2">
                        <span>
                          {DAYS[r.dayOfWeek]} · {formatMinutes(r.startMinutes)}–{formatMinutes(r.endMinutes)}
                        </span>
                        <button type="button" onClick={() => removeWeeklyRule(i)} className="text-[10px] text-rose-300/90 hover:underline">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#0c0e14]/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Unavailability</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    One-off blocked dates turn off your repeating weekly hours for that calendar day only. Check &quot;Repeat weekly&quot; to
                    block that weekday every week (cannot overlap weekly hours on that weekday).
                  </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-xs text-white/50">
                    Date
                    <input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className="ml-1 rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={blockRepeatWeekly}
                      onChange={(e) => setBlockRepeatWeekly(e.target.checked)}
                      className="rounded border-white/20 bg-[#0E1016]"
                    />
                    Repeat weekly
                  </label>
                  <button
                    type="button"
                    onClick={addBlackout}
                    className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-rose-100/90"
                  >
                    Add blackout
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ul className="space-y-1 text-xs text-white/70">
                    <li className="text-white/40">One-off blocked dates</li>
                    {(doc.unavailableDatesOnce ?? []).map((u, i) => (
                      <li key={u.date} className="flex justify-between gap-2">
                        {u.date}
                        <button type="button" className="text-rose-300/90 hover:underline" onClick={() => removeBlackoutOnce(i)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-1 text-xs text-white/70">
                    <li className="text-white/40">Recurring blocked weekdays</li>
                    {(doc.unavailableWeekdaysAllDay ?? []).map((u, i) => (
                      <li key={u.dayOfWeek} className="flex justify-between gap-2">
                        Every {DAYS_LONG[u.dayOfWeek]}
                        <button type="button" className="text-rose-300/90 hover:underline" onClick={() => removeBlackoutWeekly(i)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0c0e14]/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">One-off availability (non-repeating)</p>
                <p className="mt-1 text-[11px] text-white/45">Extra openings outside your weekly pattern.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-white/50">
                    Start
                    <input
                      type="datetime-local"
                      value={oneOffStart}
                      onChange={(e) => setOneOffStart(e.target.value)}
                      className="ml-1 rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-white/50">
                    End
                    <input
                      type="datetime-local"
                      value={oneOffEnd}
                      onChange={(e) => setOneOffEnd(e.target.value)}
                      className="ml-1 rounded-lg border border-white/12 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addOneOffSlot}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-100/90"
                  >
                    Add slot
                  </button>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-white/70">
                  {(doc.specificSlots ?? []).map((s, i) => (
                    <li key={`${s.startAt}-${i}`} className="flex justify-between gap-2">
                      <span>
                        {new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}
                      </span>
                      <button type="button" className="text-rose-300/90 hover:underline" onClick={() => removeOneOffSlot(i)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-5">
                <button
                  type="button"
                  onClick={() => void cancelAvailabilityEdit()}
                  className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/[0.09]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={availabilitySaveBusy}
                  onClick={() => void saveAvailabilityBlocks()}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-100 disabled:opacity-40"
                >
                  {availabilitySaveBusy ? "Saving…" : "Save"}
                </button>
              </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/[0.08] bg-[#0c0e14]/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Availability calendar</p>
                  {availabilityCalendarOpen ? (
                    <p className="mt-1 text-[11px] text-white/45">
                      Tap a date for details. Orange = weekly hours, green = extra opening, red = blackout; muted orange = repeating hours
                      off for that day only (one-off blackout).
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-white/40">
                      Grid hidden — your saved rules still apply. Use Show to open the month view.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => shiftAvailCalendar(-1)}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white"
                    aria-label="Previous month"
                  >
                    ←
                  </button>
                  <span className="min-w-[8rem] text-center text-xs font-semibold text-white/85">
                    {MONTH_NAMES[availCalMonthIndex]} {availCalYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftAvailCalendar(1)}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white"
                    aria-label="Next month"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityCalendarOpen((o) => !o)}
                    className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FF9A4A] transition hover:border-white/[0.18] hover:bg-white/[0.08]"
                    aria-expanded={availabilityCalendarOpen}
                  >
                    {availabilityCalendarOpen ? "▴ Hide grid" : "▾ Show grid"}
                  </button>
                </div>
              </div>
              {availabilityCalendarOpen ? (
              <>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-white/45">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#FF7E00]" /> Weekly
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#FF7E00]/35 ring-1 ring-[#FF7E00]/25" /> Weekly off (override)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90" /> Extra
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400/90" /> Blackout
                </span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[560px] grid-cols-7 gap-px rounded-xl border border-white/[0.08] bg-white/[0.06] p-px">
                  {DAYS.map((d) => (
                    <div key={`a-${d}`} className="bg-[#0E1016] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
                      {d}
                    </div>
                  ))}
                  {availCalCells.map((cell) => {
                    const key = localDayKey(cell.date);
                    const dow = cell.date.getDay();
                    const hits = availabilityHitsForLocalDate(doc, key, dow);
                    const onceSet = new Set((doc.unavailableDatesOnce ?? []).map((u) => u.date));
                    const weeklyThisDow = (doc.weeklyRules ?? []).some((r) => r.dayOfWeek === dow && r.endMinutes > r.startMinutes);
                    const hasW = hits.some((h) => h.kind === "weekly");
                    const hasWOverridden = weeklyThisDow && onceSet.has(key);
                    const hasS = hits.some((h) => h.kind === "specific");
                    const hasB = hits.some((h) => h.kind === "blackoutWeek" || h.kind === "blackoutOnce");
                    const selected = selectedAvailYmd === key;
                    return (
                      <button
                        key={`ac-${key}`}
                        type="button"
                        onClick={() => setSelectedAvailYmd((prev) => (prev === key ? null : key))}
                        className={`min-h-[4.25rem] bg-[#0E1016] p-1.5 text-left transition hover:bg-white/[0.04] ${cell.inMonth ? "" : "opacity-40"} ${selected ? "ring-1 ring-inset ring-[#FF7E00]/55" : ""}`}
                      >
                        <div className="text-[11px] font-semibold text-white/70">{cell.date.getDate()}</div>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {hasW ? <span className="h-1.5 w-1.5 rounded-full bg-[#FF7E00]" title="Weekly hours" /> : null}
                          {hasWOverridden ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[#FF7E00]/35 ring-1 ring-[#FF7E00]/30"
                              title="Repeating hours off this date"
                            />
                          ) : null}
                          {hasS ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Extra opening" /> : null}
                          {hasB ? <span className="h-1.5 w-1.5 rounded-full bg-rose-400" title="Blackout" /> : null}
                          {!hasW && !hasWOverridden && !hasS && !hasB ? <span className="text-[9px] text-white/25">—</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedAvailYmd ? (
                <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#0a0c11]/90 p-3">
                  <p className="text-xs font-semibold text-white/85">{selectedAvailYmd}</p>
                  {selectedAvailHits.length === 0 ? (
                    <p className="mt-2 text-xs text-white/45">Nothing on this date.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedAvailHits.map((h, idx) => (
                        <li
                          key={`${h.kind}-${"index" in h ? h.index : "x"}-${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/75"
                        >
                          <span>{h.label}</span>
                          {availabilityEditMode && h.kind !== "weeklyPausedForDate" ? (
                            <button
                              type="button"
                              onClick={() => removeAvailabilityHit(h)}
                              className="shrink-0 rounded-lg border border-rose-500/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-200/90 hover:bg-rose-500/10"
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[10px] text-white/38">
                    {availabilityEditMode
                      ? "Use Save at the bottom when you are done editing."
                      : "Tap Edit availability to add, remove, or change rules."}
                  </p>
                </div>
              ) : null}
              </>
              ) : null}
            </div>
          </div>

          {!availabilityEditMode ? (
            <div className="mt-6 flex justify-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSavedAvailabilityOk(false);
                  setValidationErr(null);
                  setActionErr(null);
                  setAvailabilityFetchErr(null);
                  const n = new Date();
                  setAvailCalYear(n.getFullYear());
                  setAvailCalMonthIndex(n.getMonth());
                  setSelectedAvailYmd(null);
                  setAvailabilityEditMode(true);
                }}
                className="inline-flex min-h-[2.5rem] w-full max-w-xs items-center justify-center rounded-xl border border-[#FF7E00]/50 bg-gradient-to-br from-[#FF7E00]/25 to-[#FF5A00]/10 px-5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_-8px_rgba(255,126,0,0.45)] transition hover:border-[#FF7E00]/70 hover:brightness-110 sm:w-auto sm:max-w-none"
              >
                Edit availability
              </button>
            </div>
          ) : null}

          {savedAvailabilityOk ? <p className="relative mt-4 text-xs text-emerald-300/90">Availability saved.</p> : null}
        </div>
      </section>

      {/* Booking calendar */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#10131c]/95 shadow-[0_0_0_1px_rgba(99,102,241,0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_80%_-10%,rgba(99,102,241,0.1),transparent_45%)]"
        />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Booking Calendar</h2>
              <p className="mt-1.5 max-w-md text-xs text-white/50">Use the arrows to change month. The list matches this range.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={syncRef}>
                <button
                  type="button"
                  onClick={() => setSyncOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/90 hover:bg-white/[0.1]"
                >
                  Sync
                  <span className="text-white/50">{syncOpen ? "▴" : "▾"}</span>
                </button>
                {syncOpen ? (
                  <div className="absolute right-0 z-20 mt-2 min-w-[14rem] rounded-xl border border-white/[0.12] bg-[#0c0e14] py-1 shadow-xl">
                    {calendarAccounts.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-white/45">No calendar accounts connected.</p>
                    ) : (
                      calendarAccounts.map((c) => (
                        <Link
                          key={c.provider}
                          href="/trainer/dashboard/video-meetings"
                          onClick={() => setSyncOpen(false)}
                          className="block px-3 py-2 text-xs text-white/85 hover:bg-white/[0.06]"
                        >
                          <span className="font-semibold text-white">{providerCalendarLabel(c.provider)}</span>
                          {c.hint ? <span className="mt-0.5 block text-[10px] text-white/40">{c.hint}</span> : null}
                          <span className="mt-1 block text-[10px] text-[#FF9A4A]/80">Open Virtual Meetings →</span>
                        </Link>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadInviteClients();
                  setInviteOpen(true);
                }}
                className="inline-flex items-center rounded-xl border border-[#FF7E00]/45 bg-gradient-to-r from-[#FF7E00]/22 to-transparent px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_6px_20px_-6px_rgba(255,126,0,0.35)] hover:brightness-110"
              >
                Send booking request
              </button>
              <button
                type="button"
                onClick={() => shiftCalendar(-1)}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08]"
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="min-w-[9rem] text-center text-sm font-semibold text-white/90">
                {MONTH_NAMES[calendarMonthIndex]} {calendarYear}
              </span>
              <button
                type="button"
                onClick={() => shiftCalendar(1)}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08]"
                aria-label="Next month"
              >
                →
              </button>
              <button
                type="button"
                disabled={bookingsBusy}
                onClick={() => void refreshBookings()}
                className="rounded-lg border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-40"
              >
                {bookingsBusy ? "…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-xl border border-white/[0.08] bg-white/[0.06] p-px">
              {DAYS.map((d) => (
                <div key={d} className="bg-[#0E1016] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
                  {d}
                </div>
              ))}
              {calendarCells.map((cell) => {
                const key = localDayKey(cell.date);
                const dayBookings = bookingsByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={`min-h-[5.5rem] bg-[#0E1016] p-1.5 sm:p-2 ${cell.inMonth ? "" : "opacity-40"}`}
                  >
                    <div className="text-[11px] font-semibold text-white/70">{cell.date.getDate()}</div>
                    <ul className="mt-1 space-y-0.5">
                      {dayBookings.slice(0, 2).map((b) => (
                        <li
                          key={b.id}
                          className="truncate rounded border border-white/[0.06] bg-[#FF7E00]/10 px-1 py-0.5 text-[9px] leading-tight text-white/85"
                          title={`${b.clientLabel} · ${b.status} · ${b.sessionDelivery === "VIRTUAL" ? "Virtual" : "In person"}`}
                        >
                          <span className="font-semibold">
                            {new Date(b.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>{" "}
                          {b.clientLabel}
                        </li>
                      ))}
                      {dayBookings.length > 2 ? <li className="text-[9px] text-white/45">+{dayBookings.length - 2} more</li> : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <h3 className="mt-8 text-sm font-bold uppercase tracking-[0.12em] text-white/50">Session list</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {bookings.length === 0 && !bookingsBusy ? <li className="text-white/45">No sessions in this month view.</li> : null}
            {bookings.map((b) => (
              <li key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <span className="font-semibold text-white/90">{b.clientLabel}</span>{" "}
                <span className="text-white/45">@{b.clientUsername}</span>
                <div className="mt-1 text-xs text-white/55">
                  {new Date(b.startsAt).toLocaleString()} → {b.endsAt ? new Date(b.endsAt).toLocaleTimeString() : "—"} ·{" "}
                  <span className="uppercase tracking-wide text-white/40">{b.status}</span>
                  {" · "}
                  <span className="uppercase tracking-wide text-[#FF9A4A]/80">
                    {b.sessionDelivery === "VIRTUAL" ? "Virtual" : "In person"}
                  </span>
                </div>
                {b.inviteNote ? <p className="mt-1 text-xs text-white/50">{b.inviteNote}</p> : null}
                {b.videoConferenceJoinUrl && b.sessionDelivery === "VIRTUAL" ? (
                  <a
                    href={b.videoConferenceJoinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-[10px] font-black uppercase tracking-[0.1em] text-indigo-200/90 underline-offset-2 hover:underline"
                  >
                    Virtual meeting ({(b.videoConferenceProvider ?? "LINK").replace(/_/g, " ")})
                  </a>
                ) : b.sessionDelivery === "VIRTUAL" ? (
                  <p className="mt-2 text-[10px] text-white/38">
                    Virtual link: use{" "}
                    <a href="/trainer/dashboard/messages" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                      Chats
                    </a>{" "}
                    → client thread → Virtual meetings.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Settings — centered card, collapsible */}
      <div className="flex justify-center">
        <section className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0d1018]/95 p-5 text-center sm:p-7">
          <button
            type="button"
            onClick={() => setSettingsSectionOpen((o) => !o)}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-center transition hover:border-white/[0.12] hover:bg-white/[0.05]"
            aria-expanded={settingsSectionOpen}
          >
            <h2 className="text-lg font-black tracking-tight text-white">Booking &amp; Availability Settings</h2>
            <span className="text-xs font-bold text-[#FF9A4A] transition group-hover:text-[#ffb066]">
              {settingsSectionOpen ? "▴ Hide" : "▾ Show"}
            </span>
          </button>
          {!settingsSectionOpen ? (
            <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-white/40">
              Timezone, public guidelines, after-payment booking, and virtual meeting shortcuts.
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-white/45">
              Fine-tune how Match Fit talks about your time and what clients can do after they pay.
            </p>
          )}
          {settingsSectionOpen ? (
          <div className="mx-auto mt-6 max-w-md space-y-5 text-left">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Timezone (United States)</label>
              <select
                value={normalizeUsBookingTimezone(timezone)}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2.5 text-sm text-white"
              >
                {US_BOOKING_TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Guidelines (public)</label>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                rows={4}
                placeholder="e.g. Virtual weekday mornings; in-person within 10 miles of downtown weekends."
                className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={clientPublicSelfBookingEnabled}
                  onChange={(e) => setClientPublicSelfBookingEnabled(e.target.checked)}
                  className="mt-1 rounded border-white/20 bg-[#0E1016]"
                />
                <span>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-white/90">
                    LET CLIENTS BOOK FROM MY PUBLIC PAGE
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-white/75">Clients can book directly after payment.</span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/50">
                    When this is on, they can request times from your profile after checkout. Chat invites always work either way.
                    Everyone can still read your availability summary on your profile.
                  </span>
                </span>
              </label>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Virtual meeting accounts</p>
              <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-white/45">
                Connect Google Meet, Zoom, or Microsoft Teams on the{" "}
                <Link href="/trainer/dashboard/video-meetings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                  Virtual Meetings
                </Link>{" "}
                page. Apple Calendar is not available yet.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:mx-auto sm:max-w-xs">
                <Link
                  href="/trainer/dashboard/video-meetings"
                  className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/14 px-4 text-xs font-bold text-white transition hover:border-[#FF7E00]/65 hover:bg-[#FF7E00]/22"
                >
                  Open Virtual Meetings
                </Link>
              </div>
              <p className="mx-auto mt-3 max-w-sm text-[10px] text-white/38">
                Use <span className="text-white/55">Sync</span> on the Booking Calendar above for accounts you have already linked.
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                disabled={settingsSaveBusy}
                onClick={() => void saveBookingSettings()}
                className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 px-8 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-40"
              >
                {settingsSaveBusy ? "Saving…" : "Save settings"}
              </button>
            </div>
            {savedSettingsOk ? <p className="text-center text-xs text-emerald-300/90">Settings saved.</p> : null}
          </div>
          ) : null}
        </section>
      </div>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#10131c] p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Send booking request</h3>
            <p className="mt-1 text-xs text-white/50">We&apos;ll drop the invite into your chat with this client.</p>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Client</label>
            <select
              value={inviteClient}
              onChange={(e) => setInviteClient(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {inviteClients.map((c) => (
                <option key={c.clientUsername} value={c.clientUsername}>
                  {c.displayName} (@{c.clientUsername})
                </option>
              ))}
            </select>
            {inviteClients.length === 0 ? <p className="mt-2 text-xs text-amber-200/80">No eligible clients yet — chats must be official and the client must have paid.</p> : null}
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Session type</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setInviteSessionDelivery("IN_PERSON")}
                className={`min-h-[2.25rem] flex-1 rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                  inviteSessionDelivery === "IN_PERSON"
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                In person
              </button>
              <button
                type="button"
                onClick={() => setInviteSessionDelivery("VIRTUAL")}
                className={`min-h-[2.25rem] flex-1 rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                  inviteSessionDelivery === "VIRTUAL"
                    ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                Virtual meeting
              </button>
            </div>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Start</label>
            <input
              type="datetime-local"
              value={inviteStart}
              onChange={(e) => setInviteStart(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
            />
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">End</label>
            <input
              type="datetime-local"
              value={inviteEnd}
              onChange={(e) => setInviteEnd(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
            />
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Note (optional)</label>
            <input
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E1016] px-3 py-2 text-sm text-white"
              maxLength={500}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white/75 hover:bg-white/[0.06]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void submitInvite()}
                className="rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/20 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-40"
              >
                {inviteBusy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
