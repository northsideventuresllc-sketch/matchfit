"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainerBookingAvailability } from "@/lib/booking-availability";
import { defaultTrainerBookingAvailability } from "@/lib/booking-availability";

type BookingRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  inviteNote: string | null;
  clientUsername: string;
  clientLabel: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** Sunday-first grid: first/last dates shown in the month view (inclusive). */
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

export function TrainerDashboardBookingsClient() {
  const [timezone, setTimezone] = useState("America/New_York");
  const [doc, setDoc] = useState<TrainerBookingAvailability>(defaultTrainerBookingAvailability());
  const [guidelines, setGuidelines] = useState("");
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyStart, setWeeklyStart] = useState("09:00");
  const [weeklyEnd, setWeeklyEnd] = useState("12:00");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(() => new Date().getMonth());
  const [bookingsBusy, setBookingsBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const refreshBookings = useCallback(async () => {
    const { gridStart, gridEnd } = calendarGridBounds(calendarYear, calendarMonthIndex);
    setBookingsBusy(true);
    try {
      const res = await fetch(
        `/api/trainer/dashboard/bookings?from=${encodeURIComponent(gridStart.toISOString())}&to=${encodeURIComponent(gridEnd.toISOString())}`,
      );
      const data = (await res.json()) as { bookings?: BookingRow[]; error?: string };
      if (!res.ok) {
        setLoadErr(data.error ?? "Could not load bookings.");
        return;
      }
      setBookings(data.bookings ?? []);
      setLoadErr(null);
    } finally {
      setBookingsBusy(false);
    }
  }, [calendarYear, calendarMonthIndex]);

  const loadAvailability = useCallback(async () => {
    const res = await fetch("/api/trainer/dashboard/booking-availability");
    const data = (await res.json()) as { timezone?: string; document?: TrainerBookingAvailability; error?: string };
    if (!res.ok) {
      setLoadErr(data.error ?? "Could not load availability.");
      return;
    }
    if (data.timezone) setTimezone(data.timezone);
    if (data.document) {
      setDoc(data.document);
      setGuidelines(data.document.guidelinesText ?? "");
    }
    setLoadErr(null);
  }, []);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    void refreshBookings();
  }, [refreshBookings]);

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

  async function saveAvailability() {
    setSaveBusy(true);
    setSavedOk(false);
    setLoadErr(null);
    try {
      const next: TrainerBookingAvailability = {
        ...doc,
        guidelinesText: guidelines.trim() || undefined,
      };
      const res = await fetch("/api/trainer/dashboard/booking-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: next, timezone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLoadErr(data.error ?? "Save failed.");
        return;
      }
      setDoc(next);
      setSavedOk(true);
    } finally {
      setSaveBusy(false);
    }
  }

  function addWeeklyRule() {
    const sm = timeToMinutes(weeklyStart);
    const em = timeToMinutes(weeklyEnd);
    if (sm == null || em == null || em <= sm) {
      setLoadErr("Weekly window: use HH:MM times with end after start.");
      return;
    }
    setLoadErr(null);
    setDoc((d) => ({
      ...d,
      weeklyRules: [...(d.weeklyRules ?? []), { dayOfWeek: weeklyDay, startMinutes: sm, endMinutes: em }],
    }));
  }

  function removeWeeklyRule(i: number) {
    setDoc((d) => ({
      ...d,
      weeklyRules: (d.weeklyRules ?? []).filter((_, idx) => idx !== i),
    }));
  }

  return (
    <div className="space-y-10">
      {loadErr ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">{loadErr}</p>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Availability</h2>
        <p className="mt-2 text-xs text-white/50">
          Clients see a summary on your public profile (SEE AVAILABILITY). Add weekly windows or free-form guidelines.
        </p>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Timezone (IANA)</label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
        />
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Guidelines</label>
        <textarea
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          rows={4}
          placeholder="e.g. Virtual sessions weekday mornings; in-person within 10 miles of downtown on weekends."
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Weekly windows</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              value={weeklyDay}
              onChange={(e) => setWeeklyDay(parseInt(e.target.value, 10))}
              className="rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <label className="text-xs text-white/50">
              From
              <input
                type="time"
                value={weeklyStart}
                onChange={(e) => setWeeklyStart(e.target.value)}
                className="ml-1 rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="text-xs text-white/50">
              To
              <input
                type="time"
                value={weeklyEnd}
                onChange={(e) => setWeeklyEnd(e.target.value)}
                className="ml-1 rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1.5 text-xs text-white"
              />
            </label>
            <button
              type="button"
              onClick={addWeeklyRule}
              className="rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white"
            >
              Add window
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-white/70">
            {(doc.weeklyRules ?? []).map((r, i) => (
              <li key={`${r.dayOfWeek}-${r.startMinutes}-${i}`} className="flex items-center justify-between gap-2">
                <span>
                  {DAYS[r.dayOfWeek]} · {Math.floor(r.startMinutes / 60)}:{String(r.startMinutes % 60).padStart(2, "0")}–
                  {Math.floor(r.endMinutes / 60)}:{String(r.endMinutes % 60).padStart(2, "0")}
                </span>
                <button type="button" onClick={() => removeWeeklyRule(i)} className="text-[10px] text-red-300/90 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          disabled={saveBusy}
          onClick={() => void saveAvailability()}
          className="mt-4 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/18 px-5 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-40"
        >
          {saveBusy ? "Saving…" : "Save availability"}
        </button>
        {savedOk ? <p className="mt-2 text-xs text-emerald-300/90">Saved.</p> : null}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Bookings calendar</h2>
            <p className="mt-2 text-xs text-white/50">Use the arrows to change month. The list below matches the same date range.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftCalendar(-1)}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08]"
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="min-w-[10rem] text-center text-sm font-semibold text-white/90">
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
              className="ml-1 rounded-lg border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-40"
            >
              {bookingsBusy ? "…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
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
                        title={`${b.clientLabel} · ${b.status}`}
                      >
                        <span className="font-semibold">{new Date(b.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{" "}
                        {b.clientLabel}
                      </li>
                    ))}
                    {dayBookings.length > 2 ? (
                      <li className="text-[9px] text-white/45">+{dayBookings.length - 2} more</li>
                    ) : null}
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
              </div>
              {b.inviteNote ? <p className="mt-1 text-xs text-white/50">{b.inviteNote}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
