"use client";

import { useState } from "react";
import type { CheckInSessionCard } from "@/lib/chat-check-in-thread-snapshot";
import { FOREGO_PARTIAL_REFUND_NET_SLICE } from "@/lib/session-check-in";

export type CheckInThreadPayload = {
  feeDisclaimer: string;
  sessions: CheckInSessionCard[];
} | null;

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function netLedgerCents(s: CheckInSessionCard): number {
  return Math.max(0, s.coachPortionCents + s.addonPortionCents);
}

export function SessionCheckInPanelClient(props: {
  trainerUsername: string;
  checkInThread: CheckInThreadPayload;
  onUpdated: () => void;
}) {
  const { checkInThread, trainerUsername, onUpdated } = props;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resStart, setResStart] = useState<Record<string, string>>({});
  const [resEnd, setResEnd] = useState<Record<string, string>>({});
  const [disp, setDisp] = useState<
    Record<string, { wasRescheduled: boolean; wasCancelled: boolean; reasonDetail: string }>
  >({});

  if (!checkInThread?.sessions.length) return null;

  const visible = checkInThread.sessions.filter(
    (s) => s.uiPhase !== "hidden" && s.uiPhase !== "closed" && s.uiPhase !== "awaiting_confirm",
  );
  if (!visible.length) return null;

  async function post(url: string, body?: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-950/20 px-3 py-3 text-left sm:px-4">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/90">Session check-in</p>
      <p className="text-[10px] leading-relaxed text-white/50">{checkInThread.feeDisclaimer}</p>
      {err ? <p className="text-center text-xs text-rose-200/90">{err}</p> : null}
      {visible.map((s) => {
        const startKey = s.bookingId;
        const phase = s.uiPhase;
        const svc = money(s.coachPortionCents);
        const add = money(s.addonPortionCents);
        const netTotal = netLedgerCents(s);
        const halfRefund = money(Math.floor(netTotal * FOREGO_PARTIAL_REFUND_NET_SLICE));

        function disputeDefaults() {
          return disp[startKey] ?? { wasRescheduled: false, wasCancelled: false, reasonDetail: "" };
        }

        return (
          <div key={s.bookingId} className="space-y-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Scheduled session</p>
            <p className="text-xs text-white/85">
              {new Date(s.startsAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {s.endsAt ? ` – ${new Date(s.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
            <p className="text-[11px] text-white/55">
              Net ledger for this session: service <span className="font-semibold text-white/80">${svc}</span>, add-ons{" "}
              <span className="font-semibold text-white/80">${add}</span> (after Match Fit administrative and estimated card
              fees).
            </p>
            {phase === "upcoming" ? (
              <p className="text-[11px] text-white/45">Gate A check-in opens 24 hours before this start time.</p>
            ) : null}

            {(phase === "gate_a_open_presession" || phase === "gate_a_open_postsession") && !s.gateASatisfiedAt ? (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-amber-100/85">
                  {phase === "gate_a_open_presession"
                    ? "Gate A opens before start: confirm attendance or revoke before your session begins (revoke is disabled after start)."
                    : "Post-session Gate A: confirm the outcome. If we do not hear within 24 hours after the booked end time, Gate A closes automatically."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={async () => {
                      setErr(null);
                      setBusyId(s.bookingId);
                      try {
                        await post(
                          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/complete`,
                        );
                        onUpdated();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100"
                  >
                    {busyId === s.bookingId ? "…" : "Confirm (Gate A)"}
                  </button>
                  {phase === "gate_a_open_presession" ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Revoke before start? Cancels this slot with a NET service+add-on refund where Stripe allows (non-refundable portions stay retained). One credit restores when eligible.",
                          )
                        )
                          return;
                        setErr(null);
                        setBusyId(s.bookingId);
                        try {
                          await post(
                            `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/revoke`,
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded-lg border border-rose-400/35 bg-rose-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-100"
                    >
                      Revoke
                    </button>
                  ) : null}
                  {phase === "gate_a_open_postsession" ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        setErr(null);
                        setBusyId(s.bookingId);
                        try {
                          await post(
                            `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/not-complete`,
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded-lg border border-amber-400/35 bg-amber-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100"
                    >
                      Not completed
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {phase === "waiting_trainer_gate_b" ? (
              <p className="text-[11px] leading-relaxed text-sky-100/85">
                {s.gateASatisfiedAt
                  ? "Waiting on your coach’s manual Gate B (“session completed”). Funds stay on file until they confirm; payouts do not proceed without Gate B."
                  : "Closing out Gate A after the post-session window… your coach may mark Gate B once Gate A is fully recorded."}
              </p>
            ) : null}

            {phase === "payout_dispute_window" ? (
              <div className="space-y-2 rounded-md border border-orange-400/25 bg-orange-950/25 px-2 py-2">
                <p className="text-[11px] text-orange-50/95">
                  48-hour payout buffer active. Opening a dispute freezes funds until Match Fit reviews your answers on file.
                </p>
                {s.payoutBufferEndsAt ? (
                  <p className="text-[10px] text-white/50">
                    Buffer ends: {new Date(s.payoutBufferEndsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                ) : null}
                <label className="flex items-center gap-2 text-[11px] text-white/80">
                  <input
                    type="checkbox"
                    checked={disputeDefaults().wasRescheduled}
                    onChange={(e) =>
                      setDisp((m) => ({
                        ...m,
                        [startKey]: { ...disputeDefaults(), wasRescheduled: e.target.checked },
                      }))
                    }
                  />
                  The session was rescheduled
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/80">
                  <input
                    type="checkbox"
                    checked={disputeDefaults().wasCancelled}
                    onChange={(e) =>
                      setDisp((m) => ({
                        ...m,
                        [startKey]: { ...disputeDefaults(), wasCancelled: e.target.checked },
                      }))
                    }
                  />
                  The session was cancelled
                </label>
                <textarea
                  value={disputeDefaults().reasonDetail}
                  onChange={(e) =>
                    setDisp((m) => ({
                      ...m,
                      [startKey]: { ...disputeDefaults(), reasonDetail: e.target.value },
                    }))
                  }
                  placeholder="What is your specific dispute reason?"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1.5 text-xs text-white placeholder:text-white/35"
                />
                <button
                  type="button"
                  disabled={busyId !== null || !disputeDefaults().reasonDetail.trim()}
                  onClick={async () => {
                    const d = disputeDefaults();
                    if (!d.reasonDetail.trim()) {
                      setErr("Add details for Match Fit Support.");
                      return;
                    }
                    setErr(null);
                    setBusyId(s.bookingId);
                    try {
                      await post(
                        `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/dispute`,
                        {
                          wasRescheduled: d.wasRescheduled,
                          wasCancelled: d.wasCancelled,
                          reasonDetail: d.reasonDetail.trim(),
                        },
                      );
                      onUpdated();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="rounded-lg border border-orange-400/40 bg-orange-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-orange-100"
                >
                  Freeze payout — open dispute
                </button>
              </div>
            ) : null}

            {phase === "payout_dispute_frozen" ? (
              <p className="text-[11px] text-white/65">
                A payout dispute was filed — funds remain frozen pending staff review (you may reply in open support threads).
              </p>
            ) : null}

            {phase === "awaiting_followup" ? (
              <div className="space-y-3">
                <p className="text-[11px] text-white/60">
                  Request a new time, or forego this session for a partial refund (~{Math.round(FOREGO_PARTIAL_REFUND_NET_SLICE * 100)}% of net service+add-on slice, about{" "}
                  <span className="font-semibold text-white/80">${halfRefund}</span>).
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-white/45">
                    New start (local)
                    <input
                      type="datetime-local"
                      value={resStart[startKey] ?? ""}
                      onChange={(e) => setResStart((m) => ({ ...m, [startKey]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-[10px] text-white/45">
                    New end (local)
                    <input
                      type="datetime-local"
                      value={resEnd[startKey] ?? ""}
                      onChange={(e) => setResEnd((m) => ({ ...m, [startKey]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={async () => {
                      setErr(null);
                      const a = resStart[startKey];
                      const b = resEnd[startKey];
                      if (!a || !b) {
                        setErr("Pick a new start and end.");
                        return;
                      }
                      const startsAt = new Date(a);
                      const endsAt = new Date(b);
                      setBusyId(s.bookingId);
                      try {
                        await post(
                          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/reschedule`,
                          { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
                        );
                        onUpdated();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="rounded-lg border border-sky-400/35 bg-sky-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-100"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={async () => {
                      if (!window.confirm(`Forego for partial refund (~$${halfRefund}, net ledger slice)?`)) return;
                      setErr(null);
                      setBusyId(s.bookingId);
                      try {
                        await post(
                          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/forego`,
                        );
                        onUpdated();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/70"
                  >
                    Forego (partial refund)
                  </button>
                </div>
              </div>
            ) : null}
            {s.pendingReschedule ? (
              <div className="rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-2 text-[11px] text-violet-100/90">
                <p className="font-semibold text-violet-200/95">
                  {s.pendingReschedule.requestedByTrainer ? "Coach proposed a reschedule" : "Your reschedule is pending"}
                </p>
                <p className="mt-1 text-white/65">
                  {new Date(s.pendingReschedule.proposedStartAt).toLocaleString()} –{" "}
                  {new Date(s.pendingReschedule.proposedEndAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {s.pendingReschedule.requestedByTrainer ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        setErr(null);
                        setBusyId(s.pendingReschedule!.id);
                        try {
                          await post(
                            `/api/client/conversations/${encodeURIComponent(trainerUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/respond`,
                            { accept: true },
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase text-emerald-100"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Decline this time? This cancels the session with NET service+add-on refund where eligible plus credit restore.",
                          )
                        )
                          return;
                        setErr(null);
                        setBusyId(s.pendingReschedule!.id);
                        try {
                          await post(
                            `/api/client/conversations/${encodeURIComponent(trainerUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/respond`,
                            { accept: false },
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded border border-rose-400/35 bg-rose-500/12 px-2 py-1 text-[10px] font-bold uppercase text-rose-100"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={async () => {
                      setErr(null);
                      setBusyId(s.pendingReschedule!.id);
                      try {
                        await post(
                          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/withdraw`,
                        );
                        onUpdated();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="mt-2 rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase text-white/60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SessionCheckInPanelTrainer(props: {
  clientUsername: string;
  checkInThread: CheckInThreadPayload;
  onUpdated: () => void;
}) {
  const { checkInThread, clientUsername, onUpdated } = props;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resStart, setResStart] = useState<Record<string, string>>({});
  const [resEnd, setResEnd] = useState<Record<string, string>>({});

  if (!checkInThread?.sessions.length) return null;
  const visible = checkInThread.sessions.filter(
    (s) => s.uiPhase !== "hidden" && s.uiPhase !== "closed" && s.uiPhase !== "awaiting_confirm",
  );
  if (!visible.length) return null;

  async function post(url: string, body?: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-950/20 px-3 py-3 text-left sm:px-4">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-violet-200/90">Sessions & check-in</p>
      <p className="text-[10px] leading-relaxed text-white/50">{checkInThread.feeDisclaimer}</p>
      {err ? <p className="text-center text-xs text-rose-200/90">{err}</p> : null}
      {visible.map((s) => {
        const startKey = s.bookingId;
        const svc = money(s.coachPortionCents);
        const add = money(s.addonPortionCents);
        return (
          <div key={s.bookingId} className="space-y-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
            <p className="text-xs text-white/85">
              {new Date(s.startsAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-[11px] text-white/55">
              Net ledger (service): <span className="font-semibold text-white/80">${svc}</span> • add-ons:{" "}
              <span className="font-semibold text-white/80">${add}</span>
            </p>
            {s.uiPhase === "upcoming" ? (
              <p className="text-[10px] text-white/45">Client Gate A unlocks 24h before start.</p>
            ) : null}
            {s.uiPhase === "waiting_trainer_gate_b" && s.gateASatisfiedAt ? (
              <div className="space-y-2">
                <p className="text-[11px] text-emerald-100/85">Client Gate A is closed — mark Gate B (“session completed”) manually to release the payout buffer countdown.</p>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={async () => {
                    setErr(null);
                    setBusyId(s.bookingId);
                    try {
                      await post(
                        `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/bookings/${encodeURIComponent(s.bookingId)}/check-in/gate-b`,
                      );
                      onUpdated();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100"
                >
                  {busyId === s.bookingId ? "…" : "Mark session complete (Gate B)"}
                </button>
              </div>
            ) : null}
            {s.uiPhase === "payout_dispute_window" ? (
              <p className="text-[10px] text-white/55">
                48-hour payout buffer running.
                {s.payoutBufferEndsAt
                  ? ` Ends ${new Date(s.payoutBufferEndsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
                  : ""}
              </p>
            ) : null}
            {s.uiPhase === "payout_dispute_frozen" ? (
              <p className="text-[10px] text-amber-100/80">Client dispute filed — payout frozen until staff review.</p>
            ) : null}
            <p className="text-[10px] text-white/45">Clients complete Gate A in their view. Use this thread to propose or respond to reschedules.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[10px] text-white/45">
                Proposed start
                <input
                  type="datetime-local"
                  value={resStart[startKey] ?? ""}
                  onChange={(e) => setResStart((m) => ({ ...m, [startKey]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                />
              </label>
              <label className="text-[10px] text-white/45">
                Proposed end
                <input
                  type="datetime-local"
                  value={resEnd[startKey] ?? ""}
                  onChange={(e) => setResEnd((m) => ({ ...m, [startKey]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-1 text-xs text-white"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={async () => {
                setErr(null);
                const a = resStart[startKey];
                const b = resEnd[startKey];
                if (!a || !b) {
                  setErr("Pick start and end.");
                  return;
                }
                setBusyId(s.bookingId);
                try {
                  await post(
                    `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/bookings/${encodeURIComponent(s.bookingId)}/reschedule`,
                    { startsAt: new Date(a).toISOString(), endsAt: new Date(b).toISOString() },
                  );
                  onUpdated();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusyId(null);
                }
              }}
              className="rounded-lg border border-violet-400/35 bg-violet-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100"
            >
              Send reschedule
            </button>
            {s.pendingReschedule ? (
              <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-50/95">
                <p className="font-semibold text-amber-200/95">
                  {s.pendingReschedule.requestedByTrainer ? "Awaiting client on reschedule" : "Client reschedule proposal"}
                </p>
                {!s.pendingReschedule.requestedByTrainer ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        setErr(null);
                        setBusyId(s.pendingReschedule!.id);
                        try {
                          await post(
                            `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/respond`,
                            { accept: true },
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase text-emerald-100"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Decline? Cancels — late cancellation protections may apply with no payout refund.",
                          )
                        )
                          return;
                        setErr(null);
                        setBusyId(s.pendingReschedule!.id);
                        try {
                          await post(
                            `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/respond`,
                            { accept: false },
                          );
                          onUpdated();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded border border-rose-400/35 bg-rose-500/12 px-2 py-1 text-[10px] font-bold uppercase text-rose-100"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={async () => {
                      setErr(null);
                      setBusyId(s.pendingReschedule!.id);
                      try {
                        await post(
                          `/api/trainer/conversations/${encodeURIComponent(clientUsername)}/reschedule-requests/${encodeURIComponent(s.pendingReschedule!.id)}/withdraw`,
                        );
                        onUpdated();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="mt-2 rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase text-white/60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
