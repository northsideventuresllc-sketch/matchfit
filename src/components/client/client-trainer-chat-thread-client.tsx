"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatMessageBody } from "@/components/chat/chat-message-body";
import { SAFETY_REPORT_CATEGORIES, formatSafetyReportCategoryLabel } from "@/lib/safety-constants";
import type { SafetyBlockMode } from "@/lib/safety-block-modes";
import { OFF_PLATFORM_CLIENT_CHAT_NOTICE } from "@/lib/tos-off-platform-deterrent";

type Msg = { id: string; authorRole: string; body: string; createdAt: string };

type TokenTip = {
  trainerPremium: boolean;
  suggestedGift: number;
  giftedThisWeek: number;
  capPerWeek: number;
  hasQualifyingService: boolean;
};

type PhoneCallInfo = {
  ready: boolean;
  paid: boolean;
  twilioConfigured: boolean;
  clientOptIn: boolean;
  trainerOptIn: boolean;
};

type PendingBooking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  inviteNote: string | null;
  videoConferenceJoinUrl: string | null;
  videoConferenceProvider: string | null;
};
type BookingSnapshot = {
  sessionCreditsPurchased: number;
  sessionCreditsUsed: number;
  bookingUnlimitedAfterPurchase: boolean;
  creditsRemaining: number;
};

export function ClientTrainerChatThreadClient(props: { trainerUsername: string }) {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [tokenTip, setTokenTip] = useState<TokenTip | null>(null);
  const [giftAmount, setGiftAmount] = useState(20);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [blockDetails, setBlockDetails] = useState("");
  const [reportCat, setReportCat] = useState("other");
  const [reportDetails, setReportDetails] = useState("");
  const [archived, setArchived] = useState(false);
  const [canRevive, setCanRevive] = useState(false);
  const [archiveExpiresAt, setArchiveExpiresAt] = useState<string | null>(null);
  const [unmatchInitiatedBy, setUnmatchInitiatedBy] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [blockMode, setBlockMode] = useState<SafetyBlockMode>("full");
  const [voiceCallEnabled, setVoiceCallEnabled] = useState(false);
  const [phoneCall, setPhoneCall] = useState<PhoneCallInfo | null>(null);
  const [bookingSnapshot, setBookingSnapshot] = useState<BookingSnapshot | null>(null);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [callBusy, setCallBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/messages`);
      const data = (await res.json()) as {
        messages?: Msg[];
        officialChatStartedAt?: string | null;
        tokenTip?: TokenTip;
        archived?: boolean;
        canRevive?: boolean;
        archiveExpiresAt?: string | null;
        unmatchInitiatedBy?: string | null;
        voiceCallEnabled?: boolean;
        phoneCall?: PhoneCallInfo;
        bookingSnapshot?: BookingSnapshot | null;
        pendingBookings?: PendingBooking[];
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not load thread.");
        return;
      }
      setMessages(data.messages ?? []);
      setOfficial(data.officialChatStartedAt ?? null);
      setArchived(Boolean(data.archived));
      setCanRevive(Boolean(data.canRevive));
      setArchiveExpiresAt(data.archiveExpiresAt ?? null);
      setUnmatchInitiatedBy(data.unmatchInitiatedBy ?? null);
      setTokenTip(data.tokenTip ?? null);
      if (data.tokenTip?.trainerPremium) {
        const capLeft = Math.max(0, data.tokenTip.capPerWeek - data.tokenTip.giftedThisWeek);
        const next = Math.min(data.tokenTip.suggestedGift, Math.max(1, capLeft || 1));
        setGiftAmount(next);
      }
      setVoiceCallEnabled(Boolean(data.voiceCallEnabled));
      setPhoneCall(data.phoneCall ?? null);
      setBookingSnapshot(data.bookingSnapshot ?? null);
      setPendingBookings(data.pendingBookings ?? []);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [props.trainerUsername]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const checkoutParam = searchParams.get("serviceCheckout");
  const checkoutBanner =
    checkoutParam === "success"
      ? "Payment completed. Thank you — your coach has been notified via Match Fit."
      : checkoutParam === "cancel"
        ? "Checkout was canceled. You can ask your coach to resend a link when you are ready."
        : null;

  async function archiveChat() {
    if (!window.confirm("Delete this chat and unmatch? The thread moves to Archives for 90 days.")) return;
    setArchiveBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/archive`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not archive.");
        return;
      }
      window.location.href = "/client/dashboard/messages";
    } finally {
      setArchiveBusy(false);
    }
  }

  async function reviveChat() {
    setArchiveBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/revive`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not revive.");
        return;
      }
      void load();
    } finally {
      setArchiveBusy(false);
    }
  }

  async function sendTokens() {
    setErr(null);
    const res = await fetch(
      `/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/gift-tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: giftAmount }),
      },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not send tokens.");
      return;
    }
    void load();
  }

  async function startMaskedCall() {
    setCallBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/masked-call`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not start call.");
        return;
      }
      window.alert(data.message ?? "Your phone should ring shortly. Answer to connect.");
    } finally {
      setCallBusy(false);
    }
  }

  async function confirmBooking(bookingId: string) {
    setErr(null);
    const res = await fetch(
      `/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/bookings/${encodeURIComponent(bookingId)}/confirm`,
      { method: "POST" },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not confirm.");
      return;
    }
    void load();
  }

  async function declineBooking(bookingId: string) {
    setErr(null);
    const res = await fetch(
      `/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/bookings/${encodeURIComponent(bookingId)}/decline`,
      { method: "POST" },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not decline.");
      return;
    }
    void load();
  }

  async function send() {
    setErr(null);
    const res = await fetch(`/api/client/conversations/${encodeURIComponent(props.trainerUsername)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = (await res.json()) as { error?: string; message?: Msg };
    if (!res.ok) {
      setErr(data.error ?? "Could not send.");
      return;
    }
    if (data.message) setMessages((m) => [...m, data.message!]);
    setText("");
    void load();
  }

  async function blockTrainer() {
    setErr(null);
    const res = await fetch("/api/safety/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.trainerUsername,
        targetIsTrainer: true,
        reasonDetails: blockDetails || null,
        blockMode,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not block.");
      return;
    }
    window.location.href = "/client/dashboard/messages";
  }

  async function reportTrainer() {
    setErr(null);
    const res = await fetch("/api/safety/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.trainerUsername,
        targetIsTrainer: true,
        category: reportCat,
        details: reportDetails,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not submit report.");
      return;
    }
    window.location.href = "/client/dashboard/messages";
  }

  const trainerProfileHref = `/trainers/${encodeURIComponent(props.trainerUsername)}`;

  return (
    <div className="space-y-6">
      <Link
        href={trainerProfileHref}
        className="flex w-full min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-4 text-xs font-black uppercase tracking-[0.08em] text-[#FFD34E] transition hover:border-[#FF7E00]/50 hover:bg-[#FF7E00]/16"
      >
        View full coach profile
      </Link>

      {archived ? (
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm text-amber-50/95">
          <p className="font-semibold uppercase tracking-[0.1em] text-amber-200/90">Archived</p>
          <p className="text-xs leading-relaxed text-amber-50/85">
            This chat was removed from your active inbox. It stays in Archives until{" "}
            {archiveExpiresAt
              ? new Date(archiveExpiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
              : "the retention period ends"}
            , then it is deleted automatically.
            {unmatchInitiatedBy === "TRAINER"
              ? " Your coach ended this match. Only they can bring the chat back while it is still in Archives."
              : unmatchInitiatedBy === "CLIENT"
                ? " You ended this match — you can revive the chat below if you change your mind."
                : ""}
          </p>
          {canRevive ? (
            <button
              type="button"
              disabled={archiveBusy}
              onClick={() => void reviveChat()}
              className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 text-xs font-black uppercase tracking-[0.1em] text-emerald-50 transition hover:border-emerald-300/55 disabled:opacity-40"
            >
              {archiveBusy ? "Working…" : "Revive chat"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#141824]/95 via-[#0E1016]/90 to-[#0B0C0F]/95 px-4 py-3 text-[11px] leading-relaxed text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="font-semibold uppercase tracking-[0.12em] text-[#FF7E00]/85">Compliance monitoring</p>
        <p className="mt-1">
          This conversation is monitored for compliance with our{" "}
          <Link href="/terms" className="text-[#FF9A4A] underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-[#FF9A4A] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          , including automated scans and optional AI review. Suspicious activity may be reported to Match Fit staff for
          follow-up.
        </p>
      </div>

      <Link
        href={`/trainers/${encodeURIComponent(props.trainerUsername)}#coach-review`}
        className="inline-flex min-h-[2.5rem] w-full items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/[0.1] px-4 text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E] transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/16 sm:w-auto"
      >
        Rate this coach
      </Link>

      <p className="text-center sm:text-left">
        <button
          type="button"
          onClick={() => setSafetyOpen((o) => !o)}
          className="text-[11px] font-medium text-white/38 underline-offset-4 transition hover:text-white/60 hover:underline"
        >
          {safetyOpen ? "Close safety tools" : "Safety & reporting"}
        </button>
      </p>

      {safetyOpen ? (
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4">
          <p className="text-xs text-white/50">
            Reporting sends context to Match Fit, may suspend the coach until staff lift the hold, and keeps a
            compliance record for five years after closure. Limits you choose below can be changed anytime in Settings →
            Privacy.
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Limit this coach</label>
            <select
              value={blockMode}
              onChange={(e) => setBlockMode(e.target.value as SafetyBlockMode)}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            >
              <option value="full">Match browse, FitHub, and messages</option>
              <option value="match_feed_only">Match browse only</option>
              <option value="fithub_only">FitHub only</option>
              <option value="chat_only">Messages only</option>
            </select>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Optional note to staff</p>
            <textarea
              value={blockDetails}
              onChange={(e) => setBlockDetails(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void blockTrainer()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.1em] text-white"
            >
              Apply limits
            </button>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#E32B2B]/80">Report trainer</p>
            <select
              value={reportCat}
              onChange={(e) => setReportCat(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            >
              {SAFETY_REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {formatSafetyReportCategoryLabel(c).toUpperCase()}
                </option>
              ))}
            </select>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Describe what happened for Match Fit staff"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void reportTrainer()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#E32B2B]/40 bg-[#E32B2B]/12 px-4 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4]"
            >
              Submit report & suspend trainer
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">{err}</p>
      ) : null}

      {checkoutBanner ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
          {checkoutBanner}
        </p>
      ) : null}

      {!archived && !official ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100/90">
          This chat opens after the coach accepts your profile interest or sends you a discovery nudge.
        </div>
      ) : null}

      {official && !archived && tokenTip?.hasQualifyingService ? (
        <div className="rounded-2xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.07] p-4 text-sm text-white/85">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FF7E00]/90">Appreciation tokens</p>
          {!tokenTip.trainerPremium ? (
            <p className="mt-2 text-xs text-white/55">
              This coach is not on Premium Page, so token gifts are not enabled for this thread.
            </p>
          ) : (
            (() => {
              const capLeft = Math.max(0, tokenTip.capPerWeek - tokenTip.giftedThisWeek);
              return (
                <>
                  <p className="mt-2 text-xs text-white/60">
                    Suggested: <strong className="text-white/90">{tokenTip.suggestedGift}</strong> tokens. You have sent{" "}
                    <strong className="text-white/90">{tokenTip.giftedThisWeek}</strong> / {tokenTip.capPerWeek} tokens
                    to this coach this week (active subscription required; caps reduce abuse).
                  </p>
                  {capLeft < 1 ? (
                    <p className="mt-2 text-xs text-amber-100/80">Weekly gift limit reached for this coach.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs text-white/50">
                        Amount
                        <input
                          type="number"
                          min={1}
                          max={capLeft}
                          value={giftAmount}
                          onChange={(e) =>
                            setGiftAmount(
                              Math.max(1, Math.min(capLeft, parseInt(e.target.value, 10) || 1)),
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void sendTokens()}
                        className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55"
                      >
                        Send tokens
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      ) : null}

      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,126,0,0.1),transparent_55%),radial-gradient(ellipse_55%_45%_at_0%_100%,rgba(56,189,248,0.05),transparent_45%)]"
        />
        <div className="relative max-h-[28rem] min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-white/45">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/45">No messages yet.</p>
          ) : (
            messages.map((m) => {
              const mine = m.authorRole === "CLIENT";
              return (
                <div key={m.id} className={`flex min-w-0 ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`min-w-0 max-w-[min(100%,28rem)] overflow-hidden rounded-2xl px-4 py-2.5 shadow-lg ${
                      mine
                        ? "rounded-br-md border border-[#FF7E00]/25 bg-gradient-to-br from-[#FF7E00]/25 to-[#c45a00]/10 text-white/95"
                        : "rounded-bl-md border border-white/[0.08] bg-[#1a1f2e]/90 text-white/85"
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {mine ? "You" : "Coach"} ·{" "}
                      {new Date(m.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <ChatMessageBody text={m.body} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        {!archived ? (
          <div className="relative border-t border-white/[0.07] bg-[#08090d]/80 px-3 py-2.5 sm:px-4">
            <div className="flex justify-center">
              <button
                type="button"
                disabled={archiveBusy}
                onClick={() => void archiveChat()}
                className="inline-flex min-h-[2rem] items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/70 transition hover:border-red-400/35 hover:text-red-100/85 disabled:opacity-40"
              >
                {archiveBusy ? "Working…" : "Delete chat & unmatch"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {official &&
      !archived &&
      (voiceCallEnabled ||
        bookingSnapshot ||
        pendingBookings.length > 0 ||
        (phoneCall?.paid && phoneCall.twilioConfigured)) ? (
        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0c0d12]/95 px-3 py-3 sm:px-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Sessions &amp; voice</p>
          {bookingSnapshot ? (
            <p className="text-[11px] text-white/55">
              <span className="font-semibold text-white/75">Booking credits: </span>
              {bookingSnapshot.bookingUnlimitedAfterPurchase
                ? "Unlimited scheduling for your current monthly / DIY-style purchase."
                : `${bookingSnapshot.creditsRemaining} session slot(s) available to confirm.`}
            </p>
          ) : null}
          {pendingBookings.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/85">Upcoming on Match Fit</p>
              {pendingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 text-xs text-white/75">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{b.status.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 font-semibold text-white/90">
                      {new Date(b.startsAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {b.endsAt ? ` – ${new Date(b.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
                    </p>
                    {b.inviteNote ? <p className="mt-1 text-[11px] text-white/50">{b.inviteNote}</p> : null}
                    {b.videoConferenceJoinUrl ? (
                      <a
                        href={b.videoConferenceJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-indigo-400/35 bg-indigo-500/12 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-indigo-100 transition hover:border-indigo-400/50"
                      >
                        Open video ({(b.videoConferenceProvider ?? "LINK").replace(/_/g, " ")})
                      </a>
                    ) : null}
                  </div>
                  {b.status === "INVITED" ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmBooking(b.id)}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => void declineBooking(b.id)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/60"
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {phoneCall?.paid && phoneCall.twilioConfigured && !phoneCall.ready ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-50/90">
              <span className="font-bold uppercase tracking-[0.08em] text-amber-200/90">Masked calls </span>
              Both you and your coach must opt in under{" "}
              <Link href="/client/settings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                Account Settings → Masked calls &amp; phone privacy
              </Link>
              . Your real number is never shown to the coach.
            </div>
          ) : null}
          {phoneCall?.paid && !phoneCall.twilioConfigured ? (
            <p className="text-[11px] text-white/45">Masked calling is not enabled on this server yet.</p>
          ) : null}
          {!phoneCall?.paid && phoneCall?.twilioConfigured ? (
            <p className="text-[11px] text-white/45">
              Voice calls unlock after you complete at least one paid checkout with this coach on Match Fit.
            </p>
          ) : null}
          {voiceCallEnabled ? (
            <button
              type="button"
              disabled={callBusy}
              onClick={() => void startMaskedCall()}
              className="w-full rounded-lg border border-sky-400/35 bg-sky-500/12 py-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-100 transition hover:border-sky-400/50 disabled:opacity-40"
            >
              {callBusy ? "Calling…" : "Start masked call"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-3 sm:flex-row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!official || archived}
          placeholder={
            archived
              ? "Archived — messaging is paused."
              : official
                ? "Write a message…"
                : "Chat opens when the coach connects with you."
          }
          rows={3}
          className="min-h-[4.5rem] flex-1 resize-none rounded-xl border border-white/[0.1] bg-[#0E1016]/90 px-3 py-2 text-sm text-white shadow-inner placeholder:text-white/30 disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!official || archived || !text.trim()}
          onClick={() => void send()}
          className="inline-flex min-h-[3rem] shrink-0 items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-gradient-to-br from-[#FF7E00]/25 to-[#FF7E00]/10 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {official && !archived ? (
        <div className="mt-2 rounded-xl border border-white/[0.07] bg-[#08090d]/90 px-3 py-2.5 text-center text-[9px] leading-snug text-white/38 sm:px-4 sm:text-[10px] sm:leading-relaxed">
          <span className="break-words">{OFF_PLATFORM_CLIENT_CHAT_NOTICE}</span>
        </div>
      ) : null}
    </div>
  );
}
