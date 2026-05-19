"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SessionCheckInPanelClient, type CheckInThreadPayload } from "@/components/chat/session-check-in-panels";
import type {
  ClientPairGovernancePayload,
  ClientUpcomingBookingRow,
} from "@/lib/marketplace-governance-overview";
import { clientInviteConfirmationWindow } from "@/lib/session-check-in-timing";

function money(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return "0.00";
  return (cents / 100).toFixed(2);
}

function bookingDeliveryLabel(sessionDelivery: string | null): string {
  if (sessionDelivery === "VIRTUAL") return "Virtual";
  if (sessionDelivery === "IN_PERSON") return "In person";
  return "Session";
}

function BookingInviteActions(props: {
  b: ClientUpcomingBookingRow;
  busyId: string | null;
  inviteTick: number;
  onConfirm: (trainerUsername: string, bookingId: string) => void;
  onDecline: (trainerUsername: string, bookingId: string) => void;
}) {
  void props.inviteTick;
  const w = clientInviteConfirmationWindow({ scheduledStartAt: props.b.scheduledStartAt });
  return (
    <div className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-0 sm:items-end">
      {w.tooEarly ? (
        <p className="max-w-[16rem] text-right text-[10px] leading-relaxed text-sky-200/85 sm:text-left">
          Accept unlocks {w.opensAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (24 hours before start).
        </p>
      ) : null}
      {w.expired ? (
        <p className="max-w-[16rem] text-[10px] text-amber-200/85">Start time has passed — message your coach if you still need this slot.</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={props.busyId !== null || !w.canConfirm}
          onClick={() => props.onConfirm(props.b.trainerUsername, props.b.bookingId)}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-35"
        >
          {props.busyId === props.b.bookingId ? "…" : "Accept"}
        </button>
        <button
          type="button"
          disabled={props.busyId !== null || w.expired}
          onClick={() => props.onDecline(props.b.trainerUsername, props.b.bookingId)}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/60 disabled:opacity-35"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function CollapsibleCoachBubble(props: {
  title: string;
  subtitle?: string;
  defaultOpen: boolean;
  variant: "active" | "past";
  children: React.ReactNode;
}) {
  const border =
    props.variant === "past"
      ? "border-white/[0.05] bg-[#0f1118]/80 opacity-[0.92]"
      : "border-white/[0.07] bg-gradient-to-br from-[#151821]/95 to-[#0b0d12]/98";
  return (
    <details open={props.defaultOpen} className={`group rounded-2xl border ${border} shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-2xl p-5 pb-3 marker:hidden sm:p-6 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 text-left">
          <p className="text-lg font-semibold text-white">{props.title}</p>
          {props.subtitle ? <p className="mt-1 text-[11px] text-white/40">{props.subtitle}</p> : null}
        </div>
        <span className="mt-1 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-white/[0.05] px-5 pb-5 pt-2 sm:px-6 sm:pb-6">{props.children}</div>
    </details>
  );
}

function ServiceManagementFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-2xl border-t border-white/[0.06] pt-8 text-left">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">How purchases &amp; bookings work</p>
      <div className="mt-4 space-y-4 text-[11px] leading-relaxed text-white/45">
        <p>
          <span className="font-semibold text-white/70">Purchasing services.</span> Coaches sell eligible packages inside your official
          chat thread (multi-session packs, single sessions, hourly blocks, DIY plan delivery, and bundles that include add-ons). Stripe
          Checkout collects payment; Match Fit records ledger pools for services and add-ons after platform and estimated processing fees.
          Credits-based packages decrement when you confirm a booking invite; unlimited-style purchases (for example DIY or fixed cadence
          bundles flagged unlimited at checkout) skip per-invite credit decrement but still follow booking and check-in rules.
        </p>
        <p>
          <span className="font-semibold text-white/70">Bookings.</span>           Your coach sends proposed times as session booking invites (here and in Chat).{" "}
          <span className="text-white/60">You can accept an invite starting 24 hours before the scheduled start</span> until the start
          time; declining frees the proposed slot. Virtual invites expose join links once confirmed. After confirmation, Gate A check-in
          opens 24 hours before start for attendance confirmation (and again after the session if needed); your coach completes Gate B to
          release payout timing. Invites, joins, and receipts stay mirrored under Messages / Service Management.
        </p>
      </div>
    </footer>
  );
}

function UpcomingBookingsPanel(props: {
  bookings: ClientUpcomingBookingRow[];
  inviteBusyId: string | null;
  inviteErr: string | null;
  inviteTick: number;
  onConfirmInvite: (trainerUsername: string, bookingId: string) => void;
  onDeclineInvite: (trainerUsername: string, bookingId: string) => void;
}) {
  if (props.bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#12151c]/85 px-4 py-6 text-center text-[13px] text-white/50">
        <p>No upcoming sessions on file.</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/45">
          When your coach sends a session booking invite, it appears here and under that coach — you can accept or decline on this page
          (same as Chat). Virtual join links still show in Messages after you accept.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#FF7E00]/25 bg-gradient-to-br from-[#1a1510]/95 to-[#0c0d12]/98 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#FFD34E]/90">Upcoming bookings &amp; invites</p>
      <p className="mx-auto mt-2 max-w-md text-center text-[10px] leading-relaxed text-white/45">
        Session booking invites: accept or decline below. Accept is available starting 24 hours before the scheduled start until the start
        time.
      </p>
      {props.inviteErr ? <p className="mt-2 text-center text-xs text-rose-200/90">{props.inviteErr}</p> : null}
      <ul className="mt-4 space-y-3">
        {props.bookings.map((b) => {
          const startLabel = new Date(b.scheduledStartAt).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const endLabel = b.scheduledEndAt
            ? new Date(b.scheduledEndAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
            : null;
          const delivery = bookingDeliveryLabel(b.sessionDelivery);

          return (
            <li
              key={b.bookingId}
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-left sm:flex sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{b.status.replace(/_/g, " ")}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#FF9A4A]/90">{delivery}</p>
                <p className="mt-1 text-sm font-semibold text-white/90">
                  {startLabel}
                  {endLabel ? ` – ${endLabel}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-white/55">
                  Coach <span className="text-white/80">{b.trainerDisplayName}</span> (@{b.trainerUsername})
                </p>
                {b.inviteNote ? (
                  <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/60">
                    {b.inviteNote}
                  </p>
                ) : null}
                {b.status === "CLIENT_CONFIRMED" ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-emerald-200/85">
                    Confirmed. Gate A check-in opens 24 hours before start (you will get an inbox notification). Complete check-in below in
                    this coach&apos;s section when available.
                  </p>
                ) : null}
                {b.status === "PENDING_CONFIRMATION" ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-violet-200/85">
                    Awaiting confirmation per checkout rules
                    {b.confirmationDeadlineAt ? (
                      <>
                        ; resolved automatically by{" "}
                        {new Date(b.confirmationDeadlineAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        if no dispute is filed.
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                ) : null}
                {b.videoConferenceJoinUrl && b.sessionDelivery === "VIRTUAL" && b.status === "CLIENT_CONFIRMED" ? (
                  <a
                    href={b.videoConferenceJoinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-indigo-400/35 bg-indigo-500/12 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-indigo-100 transition hover:border-indigo-400/50"
                  >
                    Open virtual meeting
                  </a>
                ) : null}
              </div>
              {b.status === "INVITED" ? (
                <BookingInviteActions
                  b={b}
                  busyId={props.inviteBusyId}
                  inviteTick={props.inviteTick}
                  onConfirm={props.onConfirmInvite}
                  onDecline={props.onDeclineInvite}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CoachPairBody(props: {
  p: ClientPairGovernancePayload;
  feeDisclaimer: string;
  onAckDiy: (trainerUsername: string) => void;
  diyBusy: string | null;
  onRefresh: () => void;
  pendingBookingInvites: ClientUpcomingBookingRow[];
  inviteBusyId: string | null;
  inviteTick: number;
  onConfirmInvite: (trainerUsername: string, bookingId: string) => void;
  onDeclineInvite: (trainerUsername: string, bookingId: string) => void;
}) {
  const { p, feeDisclaimer, onAckDiy, diyBusy, onRefresh, pendingBookingInvites, inviteBusyId, inviteTick, onConfirmInvite, onDeclineInvite } =
    props;
  const checkInPayload: CheckInThreadPayload = {
    feeDisclaimer,
    sessions: p.checkInSessions,
  };
  const latestEng = p.engagements[0];
  const profile = p.coachingProfile;
  const hasProfileNotes = profile && (profile.generalNotes.trim() || profile.medicalInjuryNotes.trim());

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 border-b border-white/[0.06] pb-4">
          <Link
            href={`/trainers/${encodeURIComponent(p.trainerUsername)}`}
            className="rounded-xl border border-white/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/65 transition hover:border-[#FF7E00]/40 hover:text-[#FFD34E]"
          >
            Profile
          </Link>
          <Link
            href={`/client/dashboard/messages/${encodeURIComponent(p.trainerUsername)}`}
            className="rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFD34E] transition hover:border-[#FF7E00]/55"
          >
            Chat
          </Link>
      </div>

      {pendingBookingInvites.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200/95">Pending session booking invites</p>
          <p className="mt-1 text-[10px] leading-relaxed text-amber-50/80">
            Proposed times from this coach — accept or decline here (same controls as Chat and the list above).
          </p>
          <ul className="mt-3 space-y-3">
            {pendingBookingInvites.map((b) => {
              const startLabel = new Date(b.scheduledStartAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              const endLabel = b.scheduledEndAt
                ? new Date(b.scheduledEndAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                : null;
              return (
                <li
                  key={b.bookingId}
                  className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 sm:flex sm:items-start sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Invited</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#FF9A4A]/90">
                      {bookingDeliveryLabel(b.sessionDelivery)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-white/90">
                      {startLabel}
                      {endLabel ? ` – ${endLabel}` : ""}
                    </p>
                    {b.inviteNote ? <p className="mt-1.5 text-[11px] text-white/55">{b.inviteNote}</p> : null}
                  </div>
                  <BookingInviteActions
                    b={b}
                    busyId={inviteBusyId}
                    inviteTick={inviteTick}
                    onConfirm={onConfirmInvite}
                    onDecline={onDeclineInvite}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {hasProfileNotes ? (
        <div className="mt-4 space-y-3">
          {profile!.generalNotes.trim() ? (
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-[#0c0d12]/90 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200/90">Notes from your coach</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{profile!.generalNotes.trim()}</p>
            </div>
          ) : null}
          {profile!.medicalInjuryNotes.trim() ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-200/90">Health &amp; injury context</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/82">{profile!.medicalInjuryNotes.trim()}</p>
              <p className="mt-2 text-[10px] text-white/40">Shared by your coach for training awareness — contact them with clinical questions.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {p.sessionSummaries.length > 0 ? (
        <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/15 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-200/90">Session notes from your coach</p>
          <ul className="mt-3 space-y-3">
            {p.sessionSummaries.map((s) => (
              <li key={s.id} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/38">
                  {new Date(s.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-white/78">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-950/15 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-200/85">Goals from your coach</p>
        {p.coachingGoals.length === 0 ? (
          <p className="mt-1 text-[11px] text-white/45">No goals on file yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-left text-[11px] text-white/75">
            {p.coachingGoals.map((g) => (
              <li key={g.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{g.horizon}</p>
                <p className="mt-1 text-white/90">{g.goalText}</p>
                <p className="mt-1 text-white/50">Done when: {g.completionCriteria}</p>
                <p className="mt-1 text-[10px] text-emerald-200/90">
                  {g.completedAt ? `Completed ${new Date(g.completedAt).toLocaleDateString()}` : "In progress"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/85">Sessions left</p>
          <p className="mt-1 text-sm text-white/85">
            {p.credits.bookingUnlimitedAfterPurchase ? (
              <span>Unlimited bookings on file (bundle / cadence).</span>
            ) : (
              <span>
                <strong>{p.credits.creditsRemaining}</strong> of <strong>{p.credits.sessionCreditsPurchased}</strong> scheduling credits
                remaining ({p.credits.sessionCreditsUsed} used).
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/85">Add-ons (ledger)</p>
          {p.addons ? (
            <p className="mt-1 text-sm text-white/85">
              <strong>{p.addons.remainingUnitsEstimated}</strong> estimated unit(s) left (used {p.addons.consumedUnitsEstimated} /{" "}
              {p.addons.totalUnitsFromLatestPurchase}).{" "}
              {p.addons.perAddonUnitNetCents != null ? (
                <span className="text-white/55">(~${money(p.addons.perAddonUnitNetCents)} net / unit)</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/50">No bundled add-ons recorded on latest purchase.</p>
          )}
        </div>
      </div>

      {p.pendingInviteCount > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-50/95">
          <span className="font-semibold text-amber-200">
            {p.pendingInviteCount} pending session booking invite{p.pendingInviteCount === 1 ? "" : "s"}.
          </span>{" "}
          These are proposed session times from your coach (not chat messages). Accept or decline in the yellow box above, in{" "}
          <strong className="text-amber-100/95">Upcoming bookings &amp; invites</strong>, or in Chat. Accept unlocks 24 hours before each
          scheduled start.
        </div>
      ) : null}

      {p.blockFreeSessionBookingUntilRepurchase ? (
        <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-50/95">
          <span className="font-semibold text-rose-200">Repurchase required.</span> A coach-led reschedule was declined under Match Fit
          policy. Complete a new paid checkout in Chat before more sessions can be booked.
        </div>
      ) : null}

      <div className="mt-6">
        <SessionCheckInPanelClient trainerUsername={p.trainerUsername} checkInThread={checkInPayload} onUpdated={onRefresh} />
      </div>

      {latestEng ? (
        <div className="mt-6 space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/90">DIY / plan delivery</p>
          <p className="text-[11px] text-white/55">
            Status: <span className="font-semibold text-white/85">{latestEng.status.replace(/_/g, " ")}</span>. First deliver-by:{" "}
            {new Date(latestEng.firstDeliverByAt).toLocaleDateString()}
            {latestEng.cycleFundsReleaseNotBeforeAt ? (
              <>
                {" "}
                Earliest modeled funds release guard:{" "}
                <span className="text-white/75">{new Date(latestEng.cycleFundsReleaseNotBeforeAt).toLocaleString()}</span>.
              </>
            ) : null}
          </p>
          {!latestEng.clientReceivableAcknowledgedAt && (latestEng.trainerReceivableLoggedAt || latestEng.firstDeliveredAt) ? (
            <button
              type="button"
              disabled={diyBusy === p.trainerUsername}
              onClick={() => onAckDiy(p.trainerUsername)}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
            >
              {diyBusy === p.trainerUsername ? "…" : "Acknowledge receipt (Confirmation of receivables)"}
            </button>
          ) : latestEng.clientReceivableAcknowledgedAt ? (
            <p className="text-[11px] text-emerald-200/85">Receipt acknowledged — thank you.</p>
          ) : (
            <p className="text-[11px] text-white/45">Waiting on coach to log the first DIY deliverable in Client Management.</p>
          )}
        </div>
      ) : null}
    </>
  );
}

export function ServiceManagementView(props: {
  feeDisclaimer: string;
  upcomingBookings: ClientUpcomingBookingRow[];
  activePairs: ClientPairGovernancePayload[];
  pastPairs: ClientPairGovernancePayload[];
}) {
  const router = useRouter();
  const [diyBusy, setDiyBusy] = useState<string | null>(null);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteTick, setInviteTick] = useState(0);
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    const t = window.setInterval(() => setInviteTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const confirmInvite = useCallback(
    async (trainerUsername: string, bookingId: string) => {
      setInviteErr(null);
      setInviteBusyId(bookingId);
      try {
        const res = await fetch(
          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(bookingId)}/confirm`,
          { method: "POST" },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Request failed.");
        refresh();
      } catch (e) {
        setInviteErr(e instanceof Error ? e.message : "Error");
      } finally {
        setInviteBusyId(null);
      }
    },
    [refresh],
  );

  const declineInvite = useCallback(
    async (trainerUsername: string, bookingId: string) => {
      if (!window.confirm("Decline this proposed session time?")) return;
      setInviteErr(null);
      setInviteBusyId(bookingId);
      try {
        const res = await fetch(
          `/api/client/conversations/${encodeURIComponent(trainerUsername)}/bookings/${encodeURIComponent(bookingId)}/decline`,
          { method: "POST" },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Request failed.");
        refresh();
      } catch (e) {
        setInviteErr(e instanceof Error ? e.message : "Error");
      } finally {
        setInviteBusyId(null);
      }
    },
    [refresh],
  );

  async function ackDiy(trainerUsername: string) {
    setDiyBusy(trainerUsername);
    try {
      const res = await fetch(`/api/client/conversations/${encodeURIComponent(trainerUsername)}/diy/receivable/ack`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      refresh();
    } finally {
      setDiyBusy(null);
    }
  }

  const noPairs = props.activePairs.length === 0 && props.pastPairs.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 text-left">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-2xl font-black uppercase tracking-[0.06em] text-white sm:text-3xl">
          SERVICE MANAGEMENT
        </h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/55">
          View and accept session booking invites, run session check-ins, track credits, read coach notes and goals, and manage DIY
          acknowledgements. Virtual joins also stay in Messages.
        </p>
        <Link
          href="/client/dashboard/messages"
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-[0.1em] text-white/70 transition hover:border-[#FF7E00]/35 hover:text-white"
        >
          Open Chats (invites &amp; joins)
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/40">UPCOMING BOOKINGS</h2>
        <UpcomingBookingsPanel
          bookings={props.upcomingBookings}
          inviteBusyId={inviteBusyId}
          inviteErr={inviteErr}
          inviteTick={inviteTick}
          onConfirmInvite={(u, id) => void confirmInvite(u, id)}
          onDeclineInvite={(u, id) => void declineInvite(u, id)}
        />
      </section>

      {noPairs ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-8 text-center text-sm text-white/55">
          <p>No official coach chats yet.</p>
          <p className="mt-2">
            <Link href="/client/dashboard/find-trainers" className="text-[#FF9A4A] underline-offset-4 hover:underline">
              DISCOVER COACHES →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {props.activePairs.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200/75">Active inquiries</h2>
              <div className="space-y-4">
                {props.activePairs.map((p) => (
                  <CollapsibleCoachBubble
                    key={p.trainerId}
                    variant="active"
                    defaultOpen
                    title={p.trainerDisplayName}
                    subtitle={`Coach @${p.trainerUsername}`}
                  >
                    <CoachPairBody
                      p={p}
                      feeDisclaimer={props.feeDisclaimer}
                      onAckDiy={ackDiy}
                      diyBusy={diyBusy}
                      onRefresh={refresh}
                      pendingBookingInvites={props.upcomingBookings.filter(
                        (b) => b.trainerUsername === p.trainerUsername && b.status === "INVITED",
                      )}
                      inviteBusyId={inviteBusyId}
                      inviteTick={inviteTick}
                      onConfirmInvite={(u, id) => void confirmInvite(u, id)}
                      onDeclineInvite={(u, id) => void declineInvite(u, id)}
                    />
                  </CollapsibleCoachBubble>
                ))}
              </div>
            </section>
          ) : null}

          {props.pastPairs.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Past inquiries</h2>
              <p className="text-center text-[11px] text-white/40">Archived threads — reference-only credits and history.</p>
              <div className="space-y-4">
                {props.pastPairs.map((p) => (
                  <CollapsibleCoachBubble
                    key={`past-${p.trainerId}`}
                    variant="past"
                    defaultOpen={false}
                    title={p.trainerDisplayName}
                    subtitle={`Coach @${p.trainerUsername} · archived`}
                  >
                    <CoachPairBody
                      p={p}
                      feeDisclaimer={props.feeDisclaimer}
                      onAckDiy={ackDiy}
                      diyBusy={diyBusy}
                      onRefresh={refresh}
                      pendingBookingInvites={props.upcomingBookings.filter(
                        (b) => b.trainerUsername === p.trainerUsername && b.status === "INVITED",
                      )}
                      inviteBusyId={inviteBusyId}
                      inviteTick={inviteTick}
                      onConfirmInvite={(u, id) => void confirmInvite(u, id)}
                      onDeclineInvite={(u, id) => void declineInvite(u, id)}
                    />
                  </CollapsibleCoachBubble>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <ServiceManagementFooter />
    </div>
  );
}
