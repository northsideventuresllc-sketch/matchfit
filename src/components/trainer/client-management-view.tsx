"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { SessionCheckInPanelTrainer, type CheckInThreadPayload } from "@/components/chat/session-check-in-panels";
import type { TrainerPairGovernancePayload, TrainerPunchHistoryRow } from "@/lib/marketplace-governance-overview";
import type {
  ManagementUpcomingBooking,
  PastClientRosterItem,
  PayoutPipelineRow,
  TrainerNextPunchBanner,
  TrainerRankingsPayload,
  TrainerRankingScope,
} from "@/lib/trainer-client-management-dashboard";
import type { CoachingGoalDto, DiyEngagementDto, SessionSummaryDto } from "@/lib/trainer-client-coaching";
import { trainerPairIsActiveInquiry } from "@/lib/trainer-active-inquiries";
import { isWithinTrainerPunchGeolocationWindow } from "@/lib/session-check-in-timing";
import { useNowMs } from "@/lib/use-now-ms";

function money(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return "0.00";
  return (cents / 100).toFixed(2);
}

function stickerClasses(s: ManagementUpcomingBooking["sticker"]): string {
  if (s === "CONFIRMED") return "border-emerald-400/45 bg-emerald-500/15 text-emerald-100";
  if (s === "CANCELLED") return "border-rose-400/45 bg-rose-500/15 text-rose-100";
  return "border-amber-400/45 bg-amber-500/15 text-amber-100";
}

function rangeForPreset(preset: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "24h") from.setTime(to.getTime() - 24 * 60 * 60 * 1000);
  else if (preset === "week") from.setTime(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (preset === "month") from.setMonth(from.getMonth() - 1);
  else if (preset === "year") from.setFullYear(from.getFullYear() - 1);
  else from.setTime(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function TrainerFinanceStatsPanel(props: { premium: boolean }) {
  const [resourceTab, setResourceTab] = useState<"finances" | "tax">("finances");
  const [preset, setPreset] = useState<"24h" | "week" | "month" | "year" | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    grossBilledCents: number;
    netAfterFeesCents: number;
    mileageMiles: number;
    mileageDeductionCents: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.premium) return;
    setErr(null);
    setLoading(true);
    try {
      const { from, to } =
        preset === "custom" && customFrom && customTo
          ? { from: new Date(customFrom), to: new Date(customTo) }
          : rangeForPreset(preset === "custom" ? "month" : preset);
      if (preset === "custom" && (!customFrom || !customTo)) {
        setStats(null);
        setLoading(false);
        return;
      }
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        setErr("Pick a valid custom range.");
        setLoading(false);
        return;
      }
      const maxBack = Date.now() - 730 * 24 * 60 * 60 * 1000;
      if (from.getTime() < maxBack) {
        setErr("Date range may only look back up to two years.");
        setLoading(false);
        return;
      }
      const res = await fetch(
        `/api/trainer/dashboard/client-management/finance-stats?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
      const data = (await res.json()) as typeof stats & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load stats.");
      setStats({
        grossBilledCents: data.grossBilledCents,
        netAfterFeesCents: data.netAfterFeesCents,
        mileageMiles: data.mileageMiles,
        mileageDeductionCents: data.mileageDeductionCents,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [customFrom, customTo, preset, props.premium]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!props.premium) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-4 text-center text-xs text-white/50">
        Trainer resources (finances and tax helpers) are available to Premium FitHub trainers only.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
      <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Trainer resources</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setResourceTab("finances")}
          className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
            resourceTab === "finances"
              ? "border-[#FF7E00]/45 bg-[#FF7E00]/12 text-[#FFD34E]"
              : "border-white/10 text-white/55 hover:border-white/18"
          }`}
        >
          FINANCES
        </button>
        <button
          type="button"
          onClick={() => setResourceTab("tax")}
          className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
            resourceTab === "tax"
              ? "border-[#FF7E00]/45 bg-[#FF7E00]/12 text-[#FFD34E]"
              : "border-white/10 text-white/55 hover:border-white/18"
          }`}
        >
          TAX RESOURCES
        </button>
      </div>
      {resourceTab === "finances" ? (
        <>
      <p className="mx-auto max-w-md text-[11px] text-white/45">
        Earnings summaries use checkout rows on file. Not tax advice for net figures.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {(["24h", "week", "month", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
              preset === p ? "border-[#FF7E00]/45 bg-[#FF7E00]/12 text-[#FFD34E]" : "border-white/10 text-white/55 hover:border-white/18"
            }`}
          >
            {p === "24h" ? "24 hours" : p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("custom")}
          className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
            preset === "custom" ? "border-[#FF7E00]/45 bg-[#FF7E00]/12 text-[#FFD34E]" : "border-white/10 text-white/55 hover:border-white/18"
          }`}
        >
          Custom
        </button>
      </div>
      {preset === "custom" ? (
        <div className="mx-auto grid max-w-lg gap-2 text-left sm:grid-cols-2">
          <label className="text-[10px] text-white/45">
            From (local)
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="text-[10px] text-white/45">
            To (local)
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/15 bg-white/[0.06] py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80 sm:col-span-2"
          >
            Apply range
          </button>
        </div>
      ) : null}
      {err ? <p className="text-xs text-rose-200/90">{err}</p> : null}
      {loading ? <p className="text-xs text-white/45">Loading…</p> : null}
      {stats ? (
        <div className="mx-auto grid max-w-xl gap-3 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 text-[11px] text-white/70">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Billed (checkout rows)</p>
            <p className="mt-1 text-lg font-semibold text-white">${money(stats.grossBilledCents)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 text-[11px] text-white/70">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Net after fees (est.)</p>
            <p className="mt-1 text-lg font-semibold text-white">${money(stats.netAfterFeesCents)}</p>
          </div>
        </div>
      ) : null}
        </>
      ) : (
        <>
          <p className="mx-auto max-w-md text-[11px] text-white/45">
            Not tax advice. Mileage deduction uses a placeholder IRS business-mileage rate in the UI; confirm annually with IRS
            Publication 463 or your CPA.
          </p>
          {stats ? (
            <div className="mx-auto max-w-xl rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 text-left text-[11px] text-white/70">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Miles logged (same date range as Finances)</p>
              <p className="mt-1 text-white/85">
                {stats.mileageMiles.toFixed(1)} mi · ~${money(stats.mileageDeductionCents)} estimated deduction
              </p>
            </div>
          ) : null}
          <div className="mx-auto max-w-xl space-y-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Log miles</p>
            <MileageQuickForm />
            <p className="text-[10px] text-white/40">
              Connect a third-party tracker (e.g. MileIQ, Stride) in your own workflow, then transcribe totals here by session or
              week.
            </p>
          </div>

          <div className="mx-auto max-w-xl space-y-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Log expense</p>
            <ExpenseQuickForm />
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.08em]">
            <a
              href={`/api/trainer/dashboard/client-management/expense-report-print?year=${new Date().getUTCFullYear()}`}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              Annual expense report (print / PDF) →
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function MileageQuickForm() {
  const [miles, setMiles] = useState("10");
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const m = parseFloat(miles);
    if (!Number.isFinite(m) || m <= 0) {
      setMsg("Enter a positive mileage amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/client-management/business-mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miles: m,
          occurredAt: new Date(occurredAt).toISOString(),
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setMsg("Saved.");
      setNote("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-[10px] text-white/45 sm:col-span-1">
        Miles
        <input
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-[10px] text-white/45 sm:col-span-1">
        When
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-[10px] text-white/45 sm:col-span-1">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="rounded-lg border border-emerald-400/35 bg-emerald-500/12 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 sm:col-span-3"
      >
        {busy ? "Saving…" : "Save mileage"}
      </button>
      {msg ? <p className="text-[11px] text-white/55 sm:col-span-3">{msg}</p> : null}
    </div>
  );
}

function ExpenseQuickForm() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Equipment");
  const [spentAt, setSpentAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const dollars = parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setMsg("Enter a valid dollar amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/dashboard/client-management/business-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountDollars: dollars,
          spentAt: new Date(spentAt).toISOString(),
          category,
          description: description.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setMsg("Saved. Many ordinary/necessary coach supplies are deductible — confirm with your CPA.");
      setAmount("");
      setDescription("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-[10px] text-white/45">
        Amount (USD)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="120.00"
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-[10px] text-white/45">
        Category
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="exp-cat"
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
        <datalist id="exp-cat">
          <option value="Equipment" />
          <option value="Software" />
          <option value="Travel" />
          <option value="Certifications" />
          <option value="Marketing" />
          <option value="Other" />
        </datalist>
      </label>
      <label className="text-[10px] text-white/45 sm:col-span-2">
        Date
        <input
          type="datetime-local"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-[10px] text-white/45 sm:col-span-2">
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="rounded-lg border border-violet-400/35 bg-violet-500/12 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100 sm:col-span-2"
      >
        {busy ? "Saving…" : "Save expense"}
      </button>
      {msg ? <p className="text-[11px] text-white/55 sm:col-span-2">{msg}</p> : null}
    </div>
  );
}

function PunchInBubble(props: {
  next: TrainerNextPunchBanner | null;
  consecutiveMisses: number;
  onPunched: () => void;
  punchHistory: TrainerPunchHistoryRow[];
}) {
  const nowMs = useNowMs(5000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loggedPin, setLoggedPin] = useState<{ lat: number; lng: number; bookingId: string } | null>(null);

  const windowOpen = useMemo(() => {
    if (!props.next) return false;
    return isWithinTrainerPunchGeolocationWindow(
      {
        scheduledStartAt: new Date(props.next.scheduledStartAt),
        scheduledEndAt: props.next.scheduledEndAt ? new Date(props.next.scheduledEndAt) : null,
      },
      nowMs,
    );
  }, [props.next, nowMs]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoggedPin(null);
      setErr(null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [props.next?.bookingId]);

  const punchedThisBooking = loggedPin && props.next && loggedPin.bookingId === props.next.bookingId;

  async function punch() {
    if (!props.next) return;
    setErr(null);
    setBusy(true);
    try {
      if (!navigator.geolocation) throw new Error("Location is not available in this browser.");
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 18_000,
          maximumAge: 0,
        });
      });
      const res = await fetch(
        `/api/trainer/conversations/${encodeURIComponent(props.next.clientUsername)}/bookings/${encodeURIComponent(props.next.bookingId)}/session-punch-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy ?? null,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Punch-in failed.");
      setLoggedPin({ lat: pos.coords.latitude, lng: pos.coords.longitude, bookingId: props.next.bookingId });
      props.onPunched();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as GeolocationPositionError).code === 1) {
        setErr(
          "Location sharing is blocked. Enable location permission for this site in your browser settings, then try again.",
        );
      } else {
        setErr(e instanceof Error ? e.message : "Error.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!props.next) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center text-xs text-white/45">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-white/90">Punch in</p>
        <p className="mx-auto mt-2 max-w-md">
          No upcoming booked session needs a punch-in right now. Missed punch-ins in the compliance window still count toward
          your streak ({props.consecutiveMisses} consecutive in the last evaluated sessions).
        </p>
        <a
          href="#session-previous-punches"
          className="mt-3 inline-block text-[10px] font-black tracking-[0.12em] text-sky-300 underline-offset-4 hover:underline"
        >
          PREVIOUS PUNCHES
        </a>
        {props.punchHistory.length === 0 ? (
          <div id="session-previous-punches" className="mt-5 border-t border-white/[0.08] pt-4">
            <p className="text-[11px] text-white/40">No punch-ins in the last 60 days yet.</p>
          </div>
        ) : null}
      </div>
    );
  }

  const btnActive = windowOpen && !punchedThisBooking;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-center text-sm font-black uppercase tracking-[0.12em] text-white">Punch in</p>
      <p className="mt-2 text-center text-sm font-semibold text-white">
        {props.next.clientDisplayName}{" "}
        <span className="text-xs font-normal text-white/45">@{props.next.clientUsername}</span>
      </p>
      <p className="mt-1 text-center text-xs text-white/70">
        {new Date(props.next.scheduledStartAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        {props.next.scheduledEndAt
          ? ` – ${new Date(props.next.scheduledEndAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
          : ""}
      </p>
      <p className="mx-auto mt-2 max-w-md text-center text-[11px] leading-relaxed text-white/50">
        Opens <span className="text-white/75">15 minutes before</span> start through{" "}
        <span className="text-white/75">one hour after the booked end</span>. Missed windows count toward your streak (
        {props.consecutiveMisses} consecutive).
      </p>
      {err ? <p className="mt-2 text-center text-xs text-rose-200/90">{err}</p> : null}
      {punchedThisBooking ? (
        <p className="mx-auto mt-3 max-w-md rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-center text-[11px] text-emerald-100/95">
          Your punch has been logged. Pin: {loggedPin!.lat.toFixed(4)}, {loggedPin!.lng.toFixed(4)} (approximate coordinates
          stored for compliance).
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || !btnActive}
        onClick={() => void punch()}
        className={`mt-4 w-full rounded-xl border py-3 text-[11px] font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed ${
          btnActive
            ? "border-emerald-400/55 bg-emerald-600/25 text-emerald-50 hover:bg-emerald-600/35"
            : "border-white/10 bg-white/[0.06] text-white/35"
        }`}
      >
        {busy ? "Saving location…" : punchedThisBooking ? "Punch logged" : windowOpen ? "Punch in (share location)" : "Punch in (locked)"}
      </button>
      <div className="mt-3 text-center">
        <a
          href="#session-previous-punches"
          className="inline-block text-[10px] font-black tracking-[0.12em] text-sky-300 underline-offset-4 hover:underline"
        >
          PREVIOUS PUNCHES
        </a>
      </div>
      {props.punchHistory.length === 0 ? (
        <div id="session-previous-punches" className="mt-5 border-t border-white/[0.08] pt-4 text-center">
          <p className="text-[11px] text-white/40">No punch-ins in the last 60 days yet.</p>
        </div>
      ) : null}
    </div>
  );
}

function SessionEarningsManagementBubble(props: {
  payoutPipeline: PayoutPipelineRow[];
  transactionYears: number[];
  pairs: TrainerPairGovernancePayload[];
}) {
  const year = props.transactionYears[0] ?? new Date().getUTCFullYear();
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
      <p className="text-sm font-black uppercase tracking-[0.12em] text-emerald-200/90">Session &amp; earnings management</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Client-completed sessions · your pay path</p>
      <p className="mx-auto mt-1 max-w-lg text-[11px] text-white/45">
        After the client side is satisfied, you will see buffer and clearance states here. Cleared rows hide after 72 hours.
      </p>
      <ul className="mx-auto mt-3 max-w-xl space-y-2 text-left">
        {props.payoutPipeline.length === 0 ? (
          <li className="rounded-lg border border-white/[0.05] bg-black/25 px-3 py-3 text-[11px] text-white/40">
            Nothing in the payout visibility queue right now.
          </li>
        ) : (
          props.payoutPipeline.map((r) => (
            <li key={r.bookingId} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-3 text-[11px] text-white/70">
              <p className="text-xs font-semibold text-white/85">
                @{r.clientUsername} · {new Date(r.scheduledStartAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/35">{r.fulfillmentStatus.replaceAll("_", " ")}</p>
              <p className="mt-2 text-white/60">{r.headline}</p>
              <p className="mt-2 text-emerald-200/85">
                Net ledger for this session: ${money(r.coachPortionCents + r.addonPortionCents)} (service ${money(r.coachPortionCents)} · add-ons{" "}
                ${money(r.addonPortionCents)})
              </p>
              {r.payoutBufferEndsAt ? (
                <p className="mt-1 text-[10px] text-white/40">Buffer ends {new Date(r.payoutBufferEndsAt).toLocaleString()}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.08em]">
        <Link
          href="/trainer/dashboard/client-management/transactions"
          className="text-[#FF9A4A] underline-offset-4 hover:underline"
        >
          View all past transactions (by calendar year) →
        </Link>
        <a
          href={`/api/trainer/dashboard/client-management/earnings-print?year=${year}`}
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 underline-offset-4 hover:underline"
        >
          Printable earnings PDF ({year}) →
        </a>
      </div>

      <p className="mt-8 text-sm font-black uppercase tracking-[0.12em] text-sky-200/90">Upcoming bookings</p>
      <p className="mx-auto mt-1 max-w-lg text-[11px] text-white/45">Paid / booked sessions in the planner window, grouped by client.</p>
      <div className="mx-auto mt-3 max-w-xl space-y-4 text-left">
        {props.pairs.map((p) => (
          <div key={p.clientId}>
            <p className="text-center text-xs font-semibold text-white/85">
              {p.clientDisplayName} <span className="text-white/45">@{p.clientUsername}</span>
            </p>
            <div className="mt-2">
              <UpcomingBookingsBlock clientUsername={p.clientUsername} items={p.upcomingBookings} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RankingsPanel({ premium }: { premium: boolean }) {
  const [scope, setScope] = useState<TrainerRankingScope>("ZIP");
  const [rankings, setRankings] = useState<TrainerRankingsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      if (!premium) {
        setRankings(null);
        return;
      }
      void (async () => {
        setLoading(true);
        setErr(null);
        try {
          const res = await fetch(`/api/trainer/dashboard/client-management/rankings?scope=${encodeURIComponent(scope)}`);
          const data = (await res.json()) as TrainerRankingsPayload & { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Could not load rankings.");
          if (!cancelled) setRankings(data);
        } catch (e) {
          if (!cancelled) setErr(e instanceof Error ? e.message : "Error.");
          if (!cancelled) setRankings(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [premium, scope]);

  if (!premium) return null;

  return (
    <section className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-950/15 px-4 py-5 text-center">
      <p className="text-sm font-black uppercase tracking-[0.12em] text-fuchsia-200/90">Rankings</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {(["ZIP", "STATE", "GLOBAL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${
              scope === s ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-50" : "border-white/10 text-white/55 hover:border-white/18"
            }`}
          >
            {s === "GLOBAL" ? "All Match Fit" : s === "ZIP" ? "Within my ZIP code" : "Within my state"}
          </button>
        ))}
      </div>
      <p className="mx-auto mt-2 max-w-lg text-[11px] text-white/45">
        Percentiles never show other trainers&apos; dollar totals. &quot;State region&quot; uses the first two digits of client ZIP codes
        from your completed sessions as a geographic proxy when a full state field is unavailable.
      </p>
      {loading ? <p className="mt-2 text-xs text-white/45">Loading…</p> : null}
      {err ? <p className="mt-2 text-xs text-rose-200/90">{err}</p> : null}
      {rankings ? (
        <ul className="mx-auto mt-3 grid max-w-xl gap-2 text-left text-[11px] text-white/70 sm:grid-cols-2">
          <li className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
            Sessions (Gate B): <strong className="text-white">{rankings.sessionsCompleted}</strong> · top{" "}
            {100 - rankings.sessionsCompletedPercentile}% globally
          </li>
          <li className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
            Five-star reviews: <strong className="text-white">{rankings.fiveStarReviews}</strong> · top{" "}
            {100 - rankings.fiveStarPercentile}% globally
          </li>
          <li className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
            FitHub posts: <strong className="text-white">{rankings.fitHubPosts}</strong> · top {100 - rankings.fitHubPostsPercentile}% globally
          </li>
          {rankings.cohortLabel && rankings.cohortSessionsPercentile != null ? (
            <li className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 sm:col-span-2">
              {rankings.cohortLabel}: session volume vs cohort — top {100 - rankings.cohortSessionsPercentile}%
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

type CoachingHistoryTx = {
  id: string;
  completedAt: string;
  amountCents: number;
  label: string;
  sessionCreditsGranted: number;
  bookingUnlimitedPurchase: boolean;
  ledgerNetAfterFeesCents: number | null;
};
type CoachingHistorySession = {
  id: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  fulfillmentStatus: string;
  trainerEarnCents: number;
};
type CoachingHistoryBundle = {
  transactions: CoachingHistoryTx[];
  completedSessions: CoachingHistorySession[];
  profile: { generalNotes: string; medicalInjuryNotes: string };
  goals: CoachingGoalDto[];
  sessionSummaries: SessionSummaryDto[];
  diyEngagements: DiyEngagementDto[];
  hasDiy: boolean;
};

function PastClientsScroller(props: {
  clients: PastClientRosterItem[];
  onRefresh?: () => void;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState<PastClientRosterItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bundle, setBundle] = useState<CoachingHistoryBundle | null>(null);
  const [notesGen, setNotesGen] = useState("");
  const [notesMed, setNotesMed] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [summaryOcc, setSummaryOcc] = useState("");
  const [summaryBody, setSummaryBody] = useState("");
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [goalHorizon, setGoalHorizon] = useState<"SHORT" | "LONG" | "GENERAL">("SHORT");
  const [goalText, setGoalText] = useState("");
  const [goalCrit, setGoalCrit] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [diyBusy, setDiyBusy] = useState(false);
  const [extBusy, setExtBusy] = useState(false);
  const [extHours, setExtHours] = useState("12");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const nowMs = useNowMs(60_000);

  useEffect(() => {
    if (!bundle) return;
    const t = window.setTimeout(() => {
      setNotesGen(bundle.profile?.generalNotes ?? "");
      setNotesMed(bundle.profile?.medicalInjuryNotes ?? "");
    }, 0);
    return () => window.clearTimeout(t);
  }, [bundle]);

  async function refetchBundle() {
    if (!open) return;
    const res = await fetch(
      `/api/trainer/dashboard/client-management/coaching-bundle?clientId=${encodeURIComponent(open.clientId)}`,
    );
    const data = (await res.json()) as CoachingHistoryBundle & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Could not refresh.");
    setBundle(data);
  }

  async function openClient(c: PastClientRosterItem) {
    setOpen(c);
    setErr(null);
    setBundle(null);
    setSummaryBody("");
    setGoalText("");
    setGoalCrit("");
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setSummaryOcc(d.toISOString().slice(0, 16));
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trainer/dashboard/client-management/coaching-bundle?clientId=${encodeURIComponent(c.clientId)}`,
      );
      const data = (await res.json()) as CoachingHistoryBundle & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load.");
      setBundle(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!open) return;
    setProfileBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/client-management/coaching-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: open.clientId,
          generalNotes: notesGen,
          medicalInjuryNotes: notesMed,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function addSummary() {
    if (!open || !summaryBody.trim()) return;
    const iso = new Date(summaryOcc).toISOString();
    setSummaryBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/client-management/session-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: open.clientId, occurredAt: iso, body: summaryBody.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setSummaryBody("");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setSummaryBusy(false);
    }
  }

  async function emailSummary(id: string) {
    setActionBusy(`s:${id}`);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/client-management/session-summaries/${encodeURIComponent(id)}/email`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Email failed.");
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setActionBusy(null);
    }
  }

  async function addGoal() {
    if (!open || !goalText.trim() || !goalCrit.trim()) return;
    setGoalBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/dashboard/client-management/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: open.clientId,
          horizon: goalHorizon,
          goalText: goalText.trim(),
          completionCriteria: goalCrit.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add goal.");
      setGoalText("");
      setGoalCrit("");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setGoalBusy(false);
    }
  }

  async function toggleGoal(goalId: string, completed: boolean) {
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/client-management/goals/${encodeURIComponent(goalId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    }
  }

  async function emailGoal(goalId: string) {
    setActionBusy(`g:${goalId}`);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/client-management/goals/${encodeURIComponent(goalId)}/email`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Email failed.");
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setActionBusy(null);
    }
  }

  async function logDiy(username: string) {
    setDiyBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(username)}/diy/receivable`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not log.");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setDiyBusy(false);
    }
  }

  async function requestExt(username: string) {
    const hours = parseFloat(extHours);
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) {
      setErr("Extension hours must be between 0.25 and 168.");
      return;
    }
    setExtBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(username)}/diy/extension-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoursRequested: hours }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      props.onRefresh?.();
      await refetchBundle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setExtBusy(false);
    }
  }

  const latestEng = bundle?.diyEngagements?.[0];

  if (!props.clients.length) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-sky-200/90">Client history</p>
        <p className="mx-auto mt-2 max-w-md text-[11px] text-white/45">
          {props.emptyMessage ?? "No client profiles to show here yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
      <p className="text-sm font-black uppercase tracking-[0.12em] text-sky-200/90">Client history</p>
      <p className="mx-auto mt-1 max-w-md text-[11px] text-white/45">Tap a profile for purchases, sessions, DIY receivables, notes, summaries, and goals.</p>
      <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-2">
        {props.clients.map((c) => (
          <button
            key={c.clientId}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              queueMicrotask(() => void openClient(c));
            }}
            className="flex shrink-0 flex-col items-center gap-2 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/40 text-sm font-bold text-white/70">
              {c.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                ((c.displayName ?? "").trim().slice(0, 1) || (c.username ?? "?").slice(0, 1) || "?").toUpperCase()
              )}
            </span>
            <span className="max-w-[5.5rem] truncate text-[10px] text-white/55">@{c.username}</span>
          </button>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/12 bg-[#0E1016] p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{open.displayName}</p>
                <p className="text-xs text-white/45">@{open.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-lg border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/60"
              >
                Close
              </button>
            </div>
            {loading ? <p className="mt-4 text-xs text-white/45">Loading…</p> : null}
            {err ? <p className="mt-4 text-xs text-rose-200/90">{err}</p> : null}
            {bundle ? (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/85">Purchases</p>
                  <ul className="mt-2 space-y-2 text-xs text-white/70">
                    {(bundle.transactions ?? []).length === 0 ? (
                      <li className="text-white/40">No checkout rows on file.</li>
                    ) : (
                      (bundle.transactions ?? []).map((t) => (
                        <li key={t.id} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                          <p className="text-white/85">{t.label}</p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {new Date(t.completedAt).toLocaleDateString()} · ${money(t.amountCents)} billed
                            {t.ledgerNetAfterFeesCents != null ? ` · $${money(t.ledgerNetAfterFeesCents)} net (est.)` : ""}
                          </p>
                          <p className="mt-1 text-[10px] text-white/35">
                            Credits granted: {t.bookingUnlimitedPurchase ? "Unlimited purchase" : t.sessionCreditsGranted}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/85">Completed sessions (Gate B)</p>
                  <ul className="mt-2 space-y-2 text-xs text-white/70">
                    {(bundle.completedSessions ?? []).length === 0 ? (
                      <li className="text-white/40">No completed sessions yet.</li>
                    ) : (
                      (bundle.completedSessions ?? []).map((s) => (
                        <li key={s.id} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                          <p className="text-white/85">
                            {new Date(s.scheduledStartAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {s.fulfillmentStatus} · Net ledger ${money(s.trainerEarnCents)}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/85">DIY deliverables (14-day receivable)</p>
                  {!bundle.hasDiy ? (
                    <p className="mt-2 text-[11px] text-white/40">Not applicable</p>
                  ) : latestEng ? (
                    <div className="mt-2 space-y-2 text-[11px] text-white/60">
                      <p>
                        SLA deliver-by {new Date(latestEng.firstDeliverByAt).toLocaleDateString()}
                        {latestEng.wallClockDeliverableDueAt
                          ? ` · Calendar deliverable deadline ${new Date(latestEng.wallClockDeliverableDueAt).toLocaleDateString()}`
                          : ""}
                        . Client acknowledgement:{" "}
                        <span className="text-white/85">
                          {latestEng.clientReceivableAcknowledgedAt
                            ? new Date(latestEng.clientReceivableAcknowledgedAt).toLocaleString()
                            : "Outstanding"}
                        </span>
                        .
                        {latestEng.extensionStatus === "PENDING" ? (
                          <span className="mt-1 block text-amber-200/90">
                            Extension pending client approval
                            {latestEng.extensionClientDecisionByAt
                              ? ` (decide by ${new Date(latestEng.extensionClientDecisionByAt).toLocaleString()})`
                              : ""}
                            .
                          </span>
                        ) : null}
                      </p>
                      {!latestEng.trainerReceivableLoggedAt && !latestEng.firstDeliveredAt ? (
                        <button
                          type="button"
                          disabled={diyBusy}
                          onClick={() => void logDiy(open.username)}
                          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
                        >
                          {diyBusy ? "Saving…" : "Log first deliverable (starts receivables handshake)"}
                        </button>
                      ) : latestEng.clientReceivableAcknowledgedAt ? (
                        <p className="text-emerald-200/85">Client acknowledged receipt — handshake complete for this engagement.</p>
                      ) : (
                        <p className="text-emerald-200/85">Deliverable logged — awaiting client acknowledgement.</p>
                      )}
                      {latestEng.clientPostDueAttestation === "NO_NOT_RECEIVED" &&
                      !latestEng.trainerReceivableLoggedAt &&
                      latestEng.extensionStatus !== "PENDING" &&
                      (!latestEng.trainerUrgentUploadDeadlineAt ||
                        new Date(latestEng.trainerUrgentUploadDeadlineAt).getTime() > nowMs) ? (
                        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-black/30 px-3 py-3">
                          <p className="text-[10px] text-amber-100/85">
                            Client reported non-delivery after the calendar deadline. Request extra hours (client has 48h to
                            approve or it auto-approves) or upload the deliverable before the urgent timer expires.
                          </p>
                          <label className="block text-[10px] text-white/45">
                            Extension hours
                            <input
                              type="number"
                              min={0.25}
                              step={0.25}
                              max={168}
                              value={extHours}
                              onChange={(e) => setExtHours(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={extBusy}
                            onClick={() => void requestExt(open.username)}
                            className="w-full rounded-lg border border-amber-400/40 bg-amber-500/15 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100 disabled:opacity-40"
                          >
                            {extBusy ? "Sending…" : "Request extension from client"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-white/40">Not applicable</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/85">Trainer notes</p>
                  <p className="mt-1 text-[10px] text-white/35">General coaching notes and any medical, injury, or personal factors that affect training.</p>
                  <label className="mt-2 block text-[10px] text-white/45">
                    General
                    <textarea
                      value={notesGen}
                      onChange={(e) => setNotesGen(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                    />
                  </label>
                  <label className="mt-2 block text-[10px] text-white/45">
                    Medical / injury / sensitivities
                    <textarea
                      value={notesMed}
                      onChange={(e) => setNotesMed(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={profileBusy}
                    onClick={() => void saveProfile()}
                    className="mt-2 rounded-lg border border-sky-400/35 bg-sky-500/12 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-100 disabled:opacity-40"
                  >
                    {profileBusy ? "Saving…" : "Save trainer notes"}
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/85">Session summary</p>
                  <p className="mt-1 text-[10px] text-white/35">Diary-style entries. Email sends from Match Fit on behalf of your coach (addresses are not exposed).</p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-white/70">
                    {(bundle.sessionSummaries ?? []).length === 0 ? (
                      <li className="text-white/40">No summaries yet.</li>
                    ) : (
                      (bundle.sessionSummaries ?? []).map((s) => (
                        <li key={s.id} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                          <p className="text-white/85">
                            {new Date(s.occurredAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] text-white/55">{s.body}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionBusy === `s:${s.id}`}
                              onClick={() => void emailSummary(s.id)}
                              className="rounded border border-violet-400/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-100 disabled:opacity-40"
                            >
                              {actionBusy === `s:${s.id}` ? "Sending…" : "Email client"}
                            </button>
                            {s.emailedAt ? (
                              <span className="text-[9px] text-white/35">Emailed {new Date(s.emailedAt).toLocaleString()}</span>
                            ) : null}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="mt-3 space-y-2">
                    <label className="block text-[10px] text-white/45">
                      Date &amp; time
                      <input
                        type="datetime-local"
                        value={summaryOcc}
                        onChange={(e) => setSummaryOcc(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="block text-[10px] text-white/45">
                      Notes
                      <textarea
                        value={summaryBody}
                        onChange={(e) => setSummaryBody(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={summaryBusy}
                      onClick={() => void addSummary()}
                      className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100 disabled:opacity-40"
                    >
                      {summaryBusy ? "Saving…" : "Save session summary"}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/85">Goals</p>
                  <p className="mt-1 text-[10px] text-white/35">Short, long, and general goals sync to the client service dashboard.</p>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-white/70">
                    {(bundle.goals ?? []).length === 0 ? (
                      <li className="text-white/40">No goals yet.</li>
                    ) : (
                      (bundle.goals ?? []).map((g) => (
                        <li key={g.id} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
                            {g.horizon === "SHORT" ? "Short term" : g.horizon === "LONG" ? "Long term" : "General"}
                          </p>
                          <p className="mt-1 text-white/85">{g.goalText}</p>
                          <p className="mt-1 text-[10px] text-white/45">Done when: {g.completionCriteria}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-[10px] text-white/55">
                              <input
                                type="checkbox"
                                checked={!!g.completedAt}
                                onChange={(e) => void toggleGoal(g.id, e.target.checked)}
                              />
                              Completed
                            </label>
                            <button
                              type="button"
                              disabled={actionBusy === `g:${g.id}`}
                              onClick={() => void emailGoal(g.id)}
                              className="rounded border border-emerald-400/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
                            >
                              {actionBusy === `g:${g.id}` ? "Sending…" : "Email client"}
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-[10px] text-white/45 sm:col-span-2">
                      Horizon
                      <select
                        value={goalHorizon}
                        onChange={(e) => setGoalHorizon(e.target.value as "SHORT" | "LONG" | "GENERAL")}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                      >
                        <option value="SHORT">Short term</option>
                        <option value="LONG">Long term</option>
                        <option value="GENERAL">General</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-white/45 sm:col-span-2">
                      Goal
                      <input
                        value={goalText}
                        onChange={(e) => setGoalText(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="text-[10px] text-white/45 sm:col-span-2">
                      How you&apos;ll know it&apos;s complete
                      <textarea
                        value={goalCrit}
                        onChange={(e) => setGoalCrit(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={goalBusy}
                      onClick={() => void addGoal()}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40 sm:col-span-2"
                    >
                      {goalBusy ? "Saving…" : "Add goal"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UpcomingBookingsBlock(props: { clientUsername: string; items: ManagementUpcomingBooking[] }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 px-4 py-3 text-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/85">Upcoming bookings</p>
          <p className="mt-1 text-[11px] text-white/45">Paid / booked sessions in the booking window ({props.items.length})</p>
        </div>
        <span className="shrink-0 text-lg text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {props.items.length === 0 ? (
            <li className="text-[11px] text-white/40">No upcoming sessions in the current planner window.</li>
          ) : (
            props.items.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSel(sel === b.id ? null : b.id)}
                  className="w-full rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-left transition hover:border-white/12"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/85">
                        {new Date(b.scheduledStartAt).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-[11px] text-white/50">{b.categoryLabel}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${stickerClasses(b.sticker)}`}>
                      {b.sticker.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-200/80">You earn (net ledger): ${money(b.trainerEarnCents)}</p>
                </button>
                {sel === b.id ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-white/[0.07] bg-black/35 px-3 py-3 text-[11px] text-white/65">
                    <p>
                      <span className="text-white/40">Delivery:</span> {b.sessionDelivery ?? "—"}
                    </p>
                    {b.inviteNote ? (
                      <p>
                        <span className="text-white/40">Note:</span> {b.inviteNote}
                      </p>
                    ) : null}
                    {b.videoConferenceJoinUrl ? (
                      <p>
                        <span className="text-white/40">Join link:</span>{" "}
                        <a href={b.videoConferenceJoinUrl} className="text-sky-300 underline-offset-2 hover:underline">
                          Open
                        </a>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-white/40">Fulfillment:</span> {b.fulfillmentStatus}
                    </p>
                    <p>
                      <span className="text-white/40">Trainer punch-in:</span> {b.hasTrainerPunchIn ? "Recorded" : "Not yet"}
                    </p>
                    <p>
                      <span className="text-white/40">Purchase label:</span> {b.purchaseSnapshot ?? "—"}
                    </p>
                    <p>
                      <span className="text-white/40">Sessions left on this purchase:</span>{" "}
                      {b.bookingUnlimitedOnPurchase
                        ? "Unlimited scheduling for this purchase."
                        : b.sessionsLeftOnPurchase == null
                          ? "—"
                          : b.sessionsLeftOnPurchase}
                    </p>
                    <p>
                      <span className="text-white/40">Add-on units left (est.):</span>{" "}
                      {b.addonUnitsLeftOnPurchase == null ? "—" : b.addonUnitsLeftOnPurchase}
                    </p>
                    <Link
                      href={`/trainer/dashboard/messages/${encodeURIComponent(props.clientUsername)}`}
                      className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-[#FF9A4A] underline-offset-4 hover:underline"
                    >
                      Open chat for this client →
                    </Link>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function CoachingLedgerPeek(props: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<
    {
      id: string;
      completedAt: string;
      amountCents: number;
      label: string;
      sessionCreditsGranted: number;
      bookingUnlimitedPurchase: boolean;
      ledgerNetAfterFeesCents: number | null;
    }[]
  >([]);
  const [sessions, setSessions] = useState<
    { id: string; scheduledStartAt: string; scheduledEndAt: string | null; fulfillmentStatus: string; trainerEarnCents: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        setLoading(true);
        setErr(null);
        try {
          const res = await fetch(
            `/api/trainer/dashboard/client-management/coaching-bundle?clientId=${encodeURIComponent(props.clientId)}`,
          );
          const data = (await res.json()) as {
            error?: string;
            transactions: typeof tx;
            completedSessions: typeof sessions;
          };
          if (!res.ok) throw new Error(data.error ?? "Could not load.");
          if (!cancelled) {
            setTx(data.transactions ?? []);
            setSessions(data.completedSessions ?? []);
          }
        } catch (e) {
          if (!cancelled) setErr(e instanceof Error ? e.message : "Error.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [props.clientId]);

  return (
    <details className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-left">
      <summary className="cursor-pointer text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
        Purchases &amp; completed sessions (ledger peek)
      </summary>
      {loading ? <p className="mt-2 text-[10px] text-white/40">Loading…</p> : null}
      {err ? <p className="mt-2 text-[10px] text-rose-200/90">{err}</p> : null}
      {!loading && !err ? (
        <div className="mt-3 space-y-4 text-[11px] text-white/65">
          <div>
            <p className="text-[10px] font-bold uppercase text-emerald-200/80">Purchases</p>
            <ul className="mt-1 space-y-1">
              {tx.length === 0 ? (
                <li className="text-white/35">None on file.</li>
              ) : (
                tx.slice(0, 6).map((t) => (
                  <li key={t.id} className="rounded border border-white/[0.06] bg-black/30 px-2 py-1">
                    {t.label} · ${money(t.amountCents)}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-violet-200/80">Completed sessions</p>
            <ul className="mt-1 space-y-1">
              {sessions.length === 0 ? (
                <li className="text-white/35">None yet.</li>
              ) : (
                sessions.slice(0, 6).map((s) => (
                  <li key={s.id} className="rounded border border-white/[0.06] bg-black/30 px-2 py-1">
                    {new Date(s.scheduledStartAt).toLocaleDateString()} · ${money(s.trainerEarnCents)}
                  </li>
                ))
              )}
            </ul>
          </div>
          <p className="text-[9px] text-white/35">
            When prepaid work is fully settled, this client appears in Client history for full notes, goals, and session summaries.
          </p>
        </div>
      ) : null}
    </details>
  );
}

function PairInquiryWorkBody(props: {
  p: TrainerPairGovernancePayload;
  feeDisclaimer: string;
  onUpdated: () => void;
  diyBusy: string | null;
  extHours: Record<string, string>;
  extBusy: string | null;
  setExtHours: Dispatch<SetStateAction<Record<string, string>>>;
  logDiyDeliverable: (clientUsername: string) => void | Promise<void>;
  requestDiyExtension: (clientUsername: string) => void | Promise<void>;
}) {
  const nowMs = useNowMs(60_000);
  const latestEng = props.p.engagements[0];
  const checkInPayload: CheckInThreadPayload = { feeDisclaimer: props.feeDisclaimer, sessions: props.p.checkInSessions };
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{props.p.clientDisplayName}</p>
        <p className="mt-1 text-[11px] text-white/40">@{props.p.clientUsername}</p>
        <Link
          href={`/trainer/dashboard/messages/${encodeURIComponent(props.p.clientUsername)}`}
          className="mt-3 inline-flex min-h-[2.25rem] items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFD34E]"
        >
          Open Chat thread
        </Link>
      </div>

      <UpcomingBookingsBlock clientUsername={props.p.clientUsername} items={props.p.upcomingBookings} />

      <div className="rounded-xl border border-sky-500/15 bg-sky-950/10 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/70">Invite credits (snapshot)</p>
        <p className="mt-1 text-sm text-white/75">
          {props.p.credits.bookingUnlimitedAfterPurchase ? (
            <span>Unlimited scheduling for current DIY/cadence purchase.</span>
          ) : (
            <span>
              <strong>{props.p.credits.creditsRemaining}</strong> invites remaining ({props.p.credits.sessionCreditsUsed} /
              {props.p.credits.sessionCreditsPurchased} used).
            </span>
          )}
        </p>
      </div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/85">Add-ons (ledger)</p>
        {props.p.addons ? (
          <p className="mt-1 text-sm text-white/85">
            Units left est. <strong>{props.p.addons.remainingUnitsEstimated}</strong>
            {props.p.addons.perAddonUnitNetCents != null ? (
              <>
                {" "}
                (~${money(props.p.addons.perAddonUnitNetCents)} net/unit).
              </>
            ) : (
              "."
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-white/50">No add-on bundle on latest purchase.</p>
        )}
      </div>

      {props.p.blockFreeSessionBookingUntilRepurchase ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-center text-[11px] text-amber-50/95">
          Client must purchase again before new bookings — you previously declined their reschedule proposal.
        </p>
      ) : null}

      <div className="text-left">
        <SessionCheckInPanelTrainer clientUsername={props.p.clientUsername} checkInThread={checkInPayload} onUpdated={props.onUpdated} />
      </div>

      {latestEng ? (
        <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/90">DIY / confirmation of receivables</p>
          <p className="mx-auto max-w-md text-[10px] text-white/40">
            Send plan files through Chat if needed; the button below records the receivable on this engagement for payout rules.
          </p>
          <p className="mx-auto max-w-md text-left text-[11px] text-white/55">
            SLA deliver-by {new Date(latestEng.firstDeliverByAt).toLocaleDateString()}
            {latestEng.wallClockDeliverableDueAt
              ? ` · Calendar deliverable deadline ${new Date(latestEng.wallClockDeliverableDueAt).toLocaleDateString()}`
              : ""}
            . Client acknowledgement:{" "}
            <span className="text-white/80">
              {latestEng.clientReceivableAcknowledgedAt
                ? new Date(latestEng.clientReceivableAcknowledgedAt).toLocaleString()
                : "Outstanding"}
            </span>
            .
            {latestEng.extensionStatus === "PENDING" ? (
              <span className="mt-1 block text-amber-200/90">
                Extension pending client approval
                {latestEng.extensionClientDecisionByAt
                  ? ` (decide by ${new Date(latestEng.extensionClientDecisionByAt).toLocaleString()})`
                  : ""}
                .
              </span>
            ) : null}
            {latestEng.cycleFundsReleaseNotBeforeAt ? (
              <>
                {" "}
                Modeled release-not-before{" "}
                <span className="text-white/75">{new Date(latestEng.cycleFundsReleaseNotBeforeAt).toLocaleString()}</span>.
              </>
            ) : null}
          </p>
          {!latestEng.trainerReceivableLoggedAt && !latestEng.firstDeliveredAt ? (
            <button
              type="button"
              disabled={props.diyBusy === props.p.clientUsername}
              onClick={() => void props.logDiyDeliverable(props.p.clientUsername)}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
            >
              {props.diyBusy === props.p.clientUsername ? "Saving…" : "Log first deliverable (starts receivables handshake)"}
            </button>
          ) : latestEng.clientReceivableAcknowledgedAt ? (
            <p className="text-[11px] text-emerald-200/85">Client acknowledged receipt — handshake complete for this engagement.</p>
          ) : (
            <p className="text-[11px] text-emerald-200/85">Deliverable logged — awaiting client acknowledgement.</p>
          )}
          {latestEng.clientPostDueAttestation === "NO_NOT_RECEIVED" &&
          !latestEng.trainerReceivableLoggedAt &&
          latestEng.extensionStatus !== "PENDING" &&
          (!latestEng.trainerUrgentUploadDeadlineAt ||
            new Date(latestEng.trainerUrgentUploadDeadlineAt).getTime() > nowMs) ? (
            <div className="mx-auto max-w-md space-y-2 rounded-lg border border-amber-500/30 bg-black/30 px-3 py-3 text-left">
              <p className="text-[10px] text-amber-100/85">
                Client reported non-delivery after the calendar deadline. Request extra hours (client has 48h to approve or it
                auto-approves) or upload the deliverable before the urgent timer expires.
              </p>
              <label className="block text-[10px] text-white/45">
                Extension hours
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  max={168}
                  value={props.extHours[props.p.clientUsername] ?? "12"}
                  onChange={(e) => props.setExtHours((m) => ({ ...m, [props.p.clientUsername]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                />
              </label>
              <button
                type="button"
                disabled={props.extBusy === props.p.clientUsername}
                onClick={() => void props.requestDiyExtension(props.p.clientUsername)}
                className="w-full rounded-lg border border-amber-400/40 bg-amber-500/15 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100 disabled:opacity-40"
              >
                {props.extBusy === props.p.clientUsername ? "Sending…" : "Request extension from client"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActiveInquiriesSection(props: {
  feeDisclaimer: string;
  activePairs: TrainerPairGovernancePayload[];
  onRefresh: () => void;
  diyBusy: string | null;
  extHours: Record<string, string>;
  extBusy: string | null;
  pkgReason: Record<string, string>;
  pkgBusyId: string | null;
  complaintDetails: Record<string, string>;
  complaintBusy: string | null;
  setExtHours: Dispatch<SetStateAction<Record<string, string>>>;
  setPkgReason: Dispatch<SetStateAction<Record<string, string>>>;
  setComplaintDetails: Dispatch<SetStateAction<Record<string, string>>>;
  logDiyDeliverable: (u: string) => void | Promise<void>;
  requestDiyExtension: (u: string) => void | Promise<void>;
  submitPackageCancel: (u: string) => void | Promise<void>;
  submitClientComplaint: (u: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState<TrainerPairGovernancePayload | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHelp(false), 0);
    return () => window.clearTimeout(t);
  }, [open?.clientId]);

  if (props.activePairs.length === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-amber-200/90">Active inquiries</p>
        <p className="mx-auto mt-2 max-w-md text-[11px] text-white/45">
          No paid services waiting on completion. When you finish deliverables and sessions for a client, they move to Client
          history.
        </p>
      </section>
    );
  }

  const u = open?.clientUsername;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center">
      <p className="text-sm font-black uppercase tracking-[0.12em] text-amber-200/90">Active inquiries</p>
      <p className="mx-auto mt-1 max-w-md text-[11px] text-white/45">Paid work in progress — tap a client for check-ins, DIY receivables, and credits.</p>
      <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-2">
        {props.activePairs.map((p) => (
          <button
            key={p.clientId}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              queueMicrotask(() => setOpen(p));
            }}
            className="flex shrink-0 flex-col items-center gap-2 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-amber-500/25 bg-black/40 text-sm font-bold text-white/70">
              {(
                (p.clientDisplayName ?? "").trim().slice(0, 1) ||
                (p.clientUsername ?? "?").slice(0, 1) ||
                "?"
              ).toUpperCase()}
            </span>
            <span className="max-w-[5.5rem] truncate text-[10px] text-white/55">@{p.clientUsername}</span>
          </button>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(null);
              setHelp(false);
            }
          }}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/12 bg-[#0E1016] p-5 pt-12 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setOpen(null);
                setHelp(false);
              }}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-lg font-light leading-none text-white/70 transition hover:border-white/25 hover:text-white"
            >
              ×
            </button>

            {help ? (
              <div className="space-y-5 text-left">
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">Inquiry management help</p>
                  <button type="button" onClick={() => setHelp(false)} className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-300 underline-offset-4 hover:underline">
                    Back to inquiry
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-rose-500/25 bg-black/30 px-4 py-4">
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-rose-200/90">Whole-package cancellation</p>
                  <p className="text-center text-[11px] text-white/45">
                    Distinct from cancelling a single session. Staff routes payout decisions — submit only when ending an entire
                    purchase.
                  </p>
                  <textarea
                    value={u ? props.pkgReason[u] ?? "" : ""}
                    onChange={(e) => u && props.setPkgReason((m) => ({ ...m, [u]: e.target.value }))}
                    rows={3}
                    placeholder="Reason for staff (min 10 characters)"
                    className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    disabled={!u || props.pkgBusyId === u}
                    onClick={() => u && void props.submitPackageCancel(u)}
                    className="w-full rounded-lg border border-rose-400/35 bg-rose-500/12 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-rose-100 disabled:opacity-40"
                  >
                    {u && props.pkgBusyId === u ? "Submitting…" : "Submit for staff review"}
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Complaint against client</p>
                  <p className="text-center text-[10px] leading-relaxed text-amber-200/85">
                    Match Fit treats safety reports seriously. Submitting may suspend the client account pending human review. Use
                    only for genuine policy or safety issues.
                  </p>
                  <textarea
                    value={u ? props.complaintDetails[u] ?? "" : ""}
                    onChange={(e) => u && props.setComplaintDetails((m) => ({ ...m, [u]: e.target.value }))}
                    rows={4}
                    placeholder="Describe the issue for staff (min 20 characters)"
                    className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    disabled={!u || props.complaintBusy === u}
                    onClick={() => u && void props.submitClientComplaint(u)}
                    className="w-full rounded-lg border border-amber-400/35 bg-amber-500/12 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-amber-50 disabled:opacity-40"
                  >
                    {u && props.complaintBusy === u ? "Submitting…" : "Submit complaint to Match Fit"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <PairInquiryWorkBody
                  p={open}
                  feeDisclaimer={props.feeDisclaimer}
                  onUpdated={props.onRefresh}
                  diyBusy={props.diyBusy}
                  extHours={props.extHours}
                  extBusy={props.extBusy}
                  setExtHours={props.setExtHours}
                  logDiyDeliverable={props.logDiyDeliverable}
                  requestDiyExtension={props.requestDiyExtension}
                />
                <div className="mt-4">
                  <CoachingLedgerPeek clientId={open.clientId} />
                </div>
                <div className="mt-6 border-t border-white/[0.08] pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setHelp(true)}
                    className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300 underline-offset-4 hover:underline"
                  >
                    Inquiry management help
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ClientManagementView(props: {
  feeDisclaimer: string;
  pairs: TrainerPairGovernancePayload[];
  punchHistory: TrainerPunchHistoryRow[];
  nextPunch: TrainerNextPunchBanner | null;
  pastClients: PastClientRosterItem[];
  payoutPipeline: PayoutPipelineRow[];
  transactionYears: number[];
  consecutiveMissedSessionPunches: number;
  premiumFitHub: boolean;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const [diyBusy, setDiyBusy] = useState<string | null>(null);
  const [extHours, setExtHours] = useState<Record<string, string>>({});
  const [extBusy, setExtBusy] = useState<string | null>(null);
  const [pkgReason, setPkgReason] = useState<Record<string, string>>({});
  const [pkgBusyId, setPkgBusyId] = useState<string | null>(null);
  const [complaintDetails, setComplaintDetails] = useState<Record<string, string>>({});
  const [complaintBusy, setComplaintBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const activePairs = useMemo(() => props.pairs.filter(trainerPairIsActiveInquiry), [props.pairs]);
  const activeClientIds = useMemo(() => new Set(activePairs.map((p) => p.clientId)), [activePairs]);
  const pastClientsForHistory = useMemo(
    () => props.pastClients.filter((c) => !activeClientIds.has(c.clientId)),
    [props.pastClients, activeClientIds],
  );

  async function requestDiyExtension(clientUsername: string) {
    const raw = (extHours[clientUsername] ?? "12").trim();
    const hours = parseFloat(raw);
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) {
      setErr("Extension hours must be between 0.25 and 168.");
      return;
    }
    setErr(null);
    setExtBusy(clientUsername);
    try {
      const res = await fetch(
        `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/diy/extension-request`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hoursRequested: hours }) },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      window.alert("Extension request sent to your client.");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setExtBusy(null);
    }
  }

  async function logDiyDeliverable(clientUsername: string) {
    setErr(null);
    setDiyBusy(clientUsername);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(clientUsername)}/diy/receivable`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not log deliverable.");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setDiyBusy(null);
    }
  }

  async function submitPackageCancel(clientUsername: string) {
    const reason = (pkgReason[clientUsername] ?? "").trim();
    if (reason.length < 10) {
      setErr("Staff needs at least 10 characters for package cancellation.");
      return;
    }
    setErr(null);
    setPkgBusyId(clientUsername);
    try {
      const res = await fetch(
        `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/package-cancellation-request`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submit failed.");
      setPkgReason((m) => ({ ...m, [clientUsername]: "" }));
      window.alert("Submitted for Match Fit staff review.");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setPkgBusyId(null);
    }
  }

  async function submitClientComplaint(clientUsername: string) {
    const details = (complaintDetails[clientUsername] ?? "").trim();
    if (details.length < 20) {
      setErr("Please give staff at least 20 characters describing the issue.");
      return;
    }
    setErr(null);
    setComplaintBusy(clientUsername);
    try {
      const res = await fetch("/api/safety/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: clientUsername,
          targetIsTrainer: false,
          category: "other",
          details,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Submit failed.");
      window.alert(data.message ?? "Report submitted.");
      setComplaintDetails((m) => ({ ...m, [clientUsername]: "" }));
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error.");
    } finally {
      setComplaintBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 text-left">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-2xl font-semibold text-white sm:text-3xl">Client Management</h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/55">
          Punch in, track earnings, review client history and coaching notes, and open Premium resources. Invites and checkout stay
          in Chats.
        </p>
        <Link
          href="/trainer/dashboard/messages"
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-[0.1em] text-white/70 transition hover:border-[#FF7E00]/35 hover:text-white"
        >
          Open Chats
        </Link>
      </header>

      <PunchInBubble
        next={props.nextPunch}
        consecutiveMisses={props.consecutiveMissedSessionPunches}
        onPunched={refresh}
        punchHistory={props.punchHistory}
      />

      <SessionEarningsManagementBubble
        payoutPipeline={props.payoutPipeline}
        transactionYears={props.transactionYears}
        pairs={props.pairs}
      />

      <ActiveInquiriesSection
        feeDisclaimer={props.feeDisclaimer}
        activePairs={activePairs}
        onRefresh={refresh}
        diyBusy={diyBusy}
        extHours={extHours}
        extBusy={extBusy}
        pkgReason={pkgReason}
        pkgBusyId={pkgBusyId}
        complaintDetails={complaintDetails}
        complaintBusy={complaintBusy}
        setExtHours={setExtHours}
        setPkgReason={setPkgReason}
        setComplaintDetails={setComplaintDetails}
        logDiyDeliverable={logDiyDeliverable}
        requestDiyExtension={requestDiyExtension}
        submitPackageCancel={submitPackageCancel}
        submitClientComplaint={submitClientComplaint}
      />

      <PastClientsScroller
        clients={pastClientsForHistory}
        onRefresh={refresh}
        emptyMessage={
          props.pastClients.length === 0
            ? "No prior clients on file yet."
            : "Everyone with prior work is still listed under Active inquiries until their paid services are fully settled."
        }
      />

      <TrainerFinanceStatsPanel premium={props.premiumFitHub} />

      <RankingsPanel premium={props.premiumFitHub} />

      {props.punchHistory.length > 0 ? (
        <section
          id="session-previous-punches"
          className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-5 text-center"
        >
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Previous punches</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-white/45">
            Geolocation snapshots when you tapped punch in. Keep location enabled — missed punch-ins count toward compliance.
          </p>
          <ul className="mx-auto mt-3 max-h-56 max-w-lg space-y-2 overflow-y-auto text-left text-[11px] text-white/70">
            {props.punchHistory.map((p) => (
              <li key={p.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
                <span className="text-white/85">@{p.clientUsername}</span> · session{" "}
                {new Date(p.sessionStartAt).toLocaleString()} · punched {new Date(p.punchedAt).toLocaleString()}
                <span className="mt-1 block text-[10px] text-white/40">
                  lat {p.latitude.toFixed(4)}, lng {p.longitude.toFixed(4)}
                  {p.accuracyMeters != null ? ` · ±${Math.round(p.accuracyMeters)}m` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-100">{err}</p>
      ) : null}

      {props.pairs.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-8 text-center text-sm text-white/55">
          <p>No official client chats yet.</p>
          <p className="mt-2">
            <Link href="/trainer/dashboard/interests" className="text-[#FF9A4A] underline-offset-4 hover:underline">
              Review inquiries →
            </Link>
          </p>
        </div>
      ) : props.pairs.length > 0 && activePairs.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-4 text-center text-[11px] text-white/45">
          All current paid inquiries are complete. Open <span className="text-white/70">Client history</span> for profiles and
          coaching tools.
        </p>
      ) : null}
    </div>
  );
}
