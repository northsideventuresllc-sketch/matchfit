"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatMessageBody } from "@/components/chat/chat-message-body";
import {
  CONVERSATION_RELATIONSHIP_STAGES,
  CONVERSATION_RELATIONSHIP_STAGE_LABELS,
  SAFETY_REPORT_CATEGORIES,
  formatSafetyReportCategoryLabel,
} from "@/lib/safety-constants";
import type { SafetyBlockMode } from "@/lib/safety-block-modes";
import type { TrainerCheckoutHint } from "@/lib/trainer-chat-checkout-hint";
import { OFF_PLATFORM_LIQUIDATED_DAMAGES_NOTICE } from "@/lib/tos-off-platform-deterrent";

const CHECKOUT_HINT_DISMISS_KEY = "mf_trainer_checkout_hint_dismiss";

type Msg = { id: string; authorRole: string; body: string; createdAt: string };

type PublishedService = {
  serviceId: string;
  title: string;
  priceUsd: number;
  billingLabel: string;
};

type ShareablePost = {
  id: string;
  postType: string;
  mediaUrl: string | null;
  preview: string;
  createdAt: string;
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

export function TrainerClientChatThreadClient(props: { clientUsername: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [stage, setStage] = useState("POTENTIAL_CLIENT");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [blockDetails, setBlockDetails] = useState("");
  const [reportCat, setReportCat] = useState("other");
  const [reportDetails, setReportDetails] = useState("");
  const [publishedServices, setPublishedServices] = useState<PublishedService[]>([]);
  const [shareableFitHubPosts, setShareableFitHubPosts] = useState<ShareablePost[]>([]);
  const [trainerPremiumStudio, setTrainerPremiumStudio] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [checkoutHint, setCheckoutHint] = useState<TrainerCheckoutHint | null>(null);
  const [hintBarDismissed, setHintBarDismissed] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [sendingCheckout, setSendingCheckout] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [sendingPostId, setSendingPostId] = useState<string | null>(null);
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
  const [videoOAuthProviders, setVideoOAuthProviders] = useState<string[]>([]);
  const [callBusy, setCallBusy] = useState(false);
  const [videoAttachId, setVideoAttachId] = useState<string | null>(null);
  const [manualVideoUrl, setManualVideoUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteStart, setInviteStart] = useState("");
  const [inviteEnd, setInviteEnd] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/messages`);
      const data = (await res.json()) as {
        messages?: Msg[];
        officialChatStartedAt?: string | null;
        relationshipStage?: string;
        publishedServices?: PublishedService[];
        shareableFitHubPosts?: ShareablePost[];
        trainerPremiumStudio?: boolean;
        checkoutHint?: TrainerCheckoutHint;
        archived?: boolean;
        canRevive?: boolean;
        archiveExpiresAt?: string | null;
        unmatchInitiatedBy?: string | null;
        voiceCallEnabled?: boolean;
        phoneCall?: PhoneCallInfo;
        bookingSnapshot?: BookingSnapshot | null;
        pendingBookings?: PendingBooking[];
        videoOAuthProviders?: string[];
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
      if (data.relationshipStage) setStage(data.relationshipStage);
      const ps = data.publishedServices ?? [];
      setPublishedServices(ps);
      setShareableFitHubPosts(data.shareableFitHubPosts ?? []);
      setTrainerPremiumStudio(Boolean(data.trainerPremiumStudio));
      const hint = data.checkoutHint ?? null;
      setCheckoutHint(hint);
      try {
        if (hint && sessionStorage.getItem(CHECKOUT_HINT_DISMISS_KEY) === hint.dismissToken) {
          setHintBarDismissed(true);
        } else {
          setHintBarDismissed(false);
        }
      } catch {
        setHintBarDismissed(false);
      }
      setSelectedServiceId((prev) => {
        if (ps.length === 0) return prev;
        if (!ps.some((s) => s.serviceId === prev)) return ps[0]!.serviceId;
        return prev;
      });
      setVoiceCallEnabled(Boolean(data.voiceCallEnabled));
      setPhoneCall(data.phoneCall ?? null);
      setBookingSnapshot(data.bookingSnapshot ?? null);
      setPendingBookings(data.pendingBookings ?? []);
      setVideoOAuthProviders(data.videoOAuthProviders ?? []);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [props.clientUsername]);

  async function startMaskedCallTrainer() {
    setCallBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/masked-call`, {
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

  async function saveManualVideo(bookingId: string) {
    const url = manualVideoUrl.trim();
    if (!url) {
      setErr("Paste an https meeting link.");
      return;
    }
    setVideoBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/bookings/${encodeURIComponent(bookingId)}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual", joinUrl: url }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not save link.");
        return;
      }
      setManualVideoUrl("");
      setVideoAttachId(null);
      void load();
    } finally {
      setVideoBusy(false);
    }
  }

  async function syncVideo(bookingId: string, provider: "GOOGLE" | "ZOOM" | "MICROSOFT") {
    setVideoBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/bookings/${encodeURIComponent(bookingId)}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", provider }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not create meeting.");
        return;
      }
      setVideoAttachId(null);
      void load();
    } finally {
      setVideoBusy(false);
    }
  }

  async function sendBookingInvite() {
    if (!inviteStart.trim() || !inviteEnd.trim()) {
      setErr("Choose a start and end time for the invite.");
      return;
    }
    const startsAt = new Date(inviteStart);
    const endsAt = new Date(inviteEnd);
    setInviteBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/booking-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          note: inviteNote.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not send invite.");
        return;
      }
      setInviteOpen(false);
      setInviteNote("");
      void load();
    } finally {
      setInviteBusy(false);
    }
  }

  async function archiveChat() {
    if (!window.confirm("Delete this chat and unmatch? The thread moves to Archives for 90 days.")) return;
    setArchiveBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/archive`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not archive.");
        return;
      }
      window.location.href = "/trainer/dashboard/messages";
    } finally {
      setArchiveBusy(false);
    }
  }

  async function reviveChat() {
    setArchiveBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/revive`, {
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

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function send() {
    setErr(null);
    const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/messages`, {
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

  async function sendServiceCheckout(serviceIdOverride?: string) {
    const sid = (serviceIdOverride ?? selectedServiceId).trim();
    if (!sid) return;
    setSendingCheckout(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/service-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: sid }),
        },
      );
      const data = (await res.json()) as { error?: string; message?: Msg };
      if (!res.ok) {
        setErr(data.error ?? "Could not create checkout.");
        return;
      }
      if (data.message) setMessages((m) => [...m, data.message!]);
      setServicePickerOpen(false);
      void load();
    } finally {
      setSendingCheckout(false);
    }
  }

  function dismissCheckoutHintBar() {
    if (!checkoutHint) return;
    try {
      sessionStorage.setItem(CHECKOUT_HINT_DISMISS_KEY, checkoutHint.dismissToken);
    } catch {
      /* private mode */
    }
    setHintBarDismissed(true);
  }

  async function shareFitHubPost(postId: string) {
    setSendingPostId(postId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}/share-fithub-post`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        },
      );
      const data = (await res.json()) as { error?: string; message?: Msg };
      if (!res.ok) {
        setErr(data.error ?? "Could not share post.");
        return;
      }
      if (data.message) setMessages((m) => [...m, data.message!]);
      setPlusOpen(false);
      void load();
    } finally {
      setSendingPostId(null);
    }
  }

  async function updateStage(next: string) {
    setErr(null);
    const res = await fetch(`/api/trainer/conversations/${encodeURIComponent(props.clientUsername)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipStage: next }),
    });
    const data = (await res.json()) as { error?: string; relationshipStage?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not update label.");
      return;
    }
    if (data.relationshipStage) setStage(data.relationshipStage);
  }

  async function blockClient() {
    setErr(null);
    const res = await fetch("/api/safety/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.clientUsername,
        targetIsTrainer: false,
        reasonDetails: blockDetails || null,
        blockMode,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not block.");
      return;
    }
    window.location.href = "/trainer/dashboard/messages";
  }

  async function reportClient() {
    setErr(null);
    const res = await fetch("/api/safety/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: props.clientUsername,
        targetIsTrainer: false,
        category: reportCat,
        details: reportDetails,
      }),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not submit report.");
      return;
    }
    window.location.href = "/trainer/dashboard/messages";
  }

  const checkoutHintActive =
    checkoutHint && "show" in checkoutHint && checkoutHint.show ? checkoutHint : null;
  const showAiCheckoutHint = Boolean(
    official && !archived && publishedServices.length > 0 && checkoutHintActive && !hintBarDismissed,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#141824]/95 via-[#0E1016]/90 to-[#0B0C0F]/95 px-4 py-3 text-center text-[11px] leading-relaxed text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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

      {archived ? (
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm text-amber-50/95">
          <p className="font-semibold uppercase tracking-[0.1em] text-amber-200/90">Archived</p>
          <p className="text-xs leading-relaxed text-amber-50/85">
            This chat was removed from your active inbox. It stays in Archives until{" "}
            {archiveExpiresAt
              ? new Date(archiveExpiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
              : "the retention period ends"}
            , then it is deleted automatically.
            {unmatchInitiatedBy === "CLIENT"
              ? " The client ended this match. Only they can bring the chat back while it is still in Archives."
              : unmatchInitiatedBy === "TRAINER"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Relationship label</label>
          <select
            value={stage}
            disabled={archived}
            onChange={(e) => {
              const v = e.target.value;
              setStage(v);
              void updateStage(v);
            }}
            className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#0E1016]/90 px-3 py-2.5 text-sm font-medium text-white shadow-inner disabled:opacity-40"
          >
            {CONVERSATION_RELATIONSHIP_STAGES.map((s) => (
              <option key={s} value={s}>
                {CONVERSATION_RELATIONSHIP_STAGE_LABELS[s].toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setSafetyOpen((o) => !o)}
          className="text-[11px] font-medium text-white/38 underline-offset-4 transition hover:text-white/60 hover:underline"
        >
          {safetyOpen ? "Close safety" : "Safety & Reporting"}
        </button>
      </div>

      {safetyOpen ? (
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4">
          <p className="text-xs text-white/50">
            Reports are routed to Match Fit for review and may suspend the account until staff lift the hold. Limits
            below can be changed anytime in Settings → Privacy.
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Limit this client</label>
            <select
              value={blockMode}
              onChange={(e) => setBlockMode(e.target.value as SafetyBlockMode)}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            >
              <option value="full">Discover, client feeds, and messages</option>
              <option value="discover_only">Discover only</option>
              <option value="chat_only">Messages only</option>
            </select>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Optional note</p>
            <textarea
              value={blockDetails}
              onChange={(e) => setBlockDetails(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void blockClient()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.1em] text-white"
            >
              Apply limits
            </button>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#E32B2B]/80">Report client</p>
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
              placeholder="Details for Match Fit staff"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void reportClient()}
              className="mt-2 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#E32B2B]/40 bg-[#E32B2B]/12 px-4 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4]"
            >
              Submit report & suspend client
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">{err}</p>
      ) : null}

      {!archived && !official ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100/90">
          This thread is waiting to open. If the client came from a profile inquiry, accept it from{" "}
          <Link href="/trainer/dashboard/interests" className="font-semibold text-white underline-offset-2 hover:underline">
            Inquiries
          </Link>
          .
        </div>
      ) : null}

      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,126,0,0.12),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(99,102,241,0.06),transparent_45%)]"
        />
        <div className="relative max-h-[28rem] min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-white/45">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/45">No messages yet. Say hello.</p>
          ) : (
            messages.map((m) => {
              const mine = m.authorRole === "TRAINER";
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
                      {mine ? "You" : "Client"} ·{" "}
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
        {official && !archived && publishedServices.length > 0 ? (
          <div className="relative border-t border-white/[0.07] bg-[#0a0b10]/95 px-3 py-2 sm:px-4">
            {showAiCheckoutHint && checkoutHintActive ? (
              <div className="mb-2 rounded-lg border border-sky-500/22 bg-sky-950/30 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-200/88">Assistant</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/55">
                      {checkoutHintActive.mode === "single"
                        ? "Recent client messages look checkout-ready. Send the secure Match Fit link:"
                        : "Sounds like a sale is forming—pick the closest package (ranked by fit to their wording):"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dismissCheckoutHintBar}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none text-white/35 transition hover:bg-white/[0.06] hover:text-white/75"
                    aria-label="Dismiss checkout suggestion"
                  >
                    ×
                  </button>
                </div>
                {checkoutHintActive.mode === "single" && checkoutHintActive.picks[0] ? (
                  <button
                    type="button"
                    disabled={sendingCheckout}
                    onClick={() => void sendServiceCheckout(checkoutHintActive.picks[0]!.serviceId)}
                    className="mt-2 w-full rounded-lg border border-sky-400/32 bg-sky-500/12 px-3 py-2 text-left transition hover:border-sky-400/48 hover:bg-sky-500/18 disabled:opacity-40"
                  >
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-sky-200/85">Send payment link</span>
                    <span className="mt-0.5 block line-clamp-2 text-[13px] font-semibold text-white/92">
                      {checkoutHintActive.picks[0].title}
                    </span>
                  </button>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {checkoutHintActive.picks.map((p) => (
                      <button
                        key={p.serviceId}
                        type="button"
                        disabled={sendingCheckout}
                        onClick={() => void sendServiceCheckout(p.serviceId)}
                        className="min-w-0 max-w-[100%] flex-1 basis-[calc(33.333%-0.375rem)] rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left transition hover:border-sky-400/35 hover:bg-sky-500/10 disabled:opacity-40"
                      >
                        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-white/86">{p.title}</span>
                        <span className="mt-0.5 block text-[9px] tabular-nums text-white/38">
                          {Math.round(p.probability * 100)}% likely
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setServicePickerOpen((o) => !o)}
              className="text-left text-[11px] text-white/36 underline-offset-2 transition hover:text-white/58 hover:underline"
            >
              {servicePickerOpen ? "Hide manual picker" : "Send a different checkout link…"}
            </button>
            {servicePickerOpen ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                >
                  {publishedServices.map((s) => (
                    <option key={s.serviceId} value={s.serviceId}>
                      {s.title} — ${s.priceUsd.toFixed(0)} ({s.billingLabel})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={sendingCheckout || !selectedServiceId}
                  onClick={() => void sendServiceCheckout()}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#FF7E00]/38 bg-[#FF7E00]/14 px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 disabled:opacity-40"
                >
                  {sendingCheckout ? "Sending…" : "Send link"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Bookings, video &amp; voice</p>
          {bookingSnapshot ? (
            <p className="text-[11px] text-white/55">
              <span className="font-semibold text-white/75">Client booking credits: </span>
              {bookingSnapshot.bookingUnlimitedAfterPurchase
                ? "Unlimited scheduling (monthly / DIY-style purchase on file)."
                : `${bookingSnapshot.creditsRemaining} session slot(s) left to invite (pending invites count against this).`}
            </p>
          ) : null}
          {pendingBookings.length > 0 ? (
            <div className="space-y-2 text-[11px] text-white/55">
              <span className="font-bold uppercase tracking-[0.1em] text-sky-200/85">Sessions on calendar</span>
              <ul className="mt-1 space-y-2">
                {pendingBookings.map((b) => (
                  <li key={b.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{b.status.replace(/_/g, " ")}</p>
                        <p className="text-xs text-white/80">
                          {new Date(b.startsAt).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        {b.videoConferenceJoinUrl ? (
                          <a
                            href={b.videoConferenceJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-200/90 underline-offset-2 hover:underline"
                          >
                            Open current video link
                          </a>
                        ) : null}
                      </div>
                      {phoneCall?.paid ? (
                        <button
                          type="button"
                          disabled={videoBusy}
                          onClick={() => {
                            setVideoAttachId((id) => (id === b.id ? null : b.id));
                            setManualVideoUrl("");
                          }}
                          className="shrink-0 self-start rounded-lg border border-white/12 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/65 transition hover:border-[#FF7E00]/40 hover:text-white/90 disabled:opacity-40"
                        >
                          {videoAttachId === b.id ? "Close video tools" : "Video link"}
                        </button>
                      ) : null}
                    </div>
                    {videoAttachId === b.id && phoneCall?.paid ? (
                      <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
                        <p className="text-[10px] text-white/45">
                          Manual link or sync creates a meeting for this booking window. Manage OAuth under{" "}
                          <Link href="/trainer/dashboard/video-meetings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                            Video
                          </Link>
                          .
                        </p>
                        <input
                          value={manualVideoUrl}
                          onChange={(e) => setManualVideoUrl(e.target.value)}
                          placeholder="https://… (Meet, Zoom, or Teams)"
                          className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white placeholder:text-white/30"
                        />
                        <button
                          type="button"
                          disabled={videoBusy}
                          onClick={() => void saveManualVideo(b.id)}
                          className="w-full rounded-lg border border-indigo-400/35 bg-indigo-500/12 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-indigo-100 disabled:opacity-40"
                        >
                          Save manual link
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                          {(["GOOGLE", "ZOOM", "MICROSOFT"] as const).map((p) => {
                            const connected = videoOAuthProviders.includes(p);
                            const label = p === "GOOGLE" ? "Meet" : p === "ZOOM" ? "Zoom" : "Teams";
                            return (
                              <button
                                key={p}
                                type="button"
                                disabled={videoBusy || !connected}
                                title={!connected ? `Connect ${label} on the Video page first` : undefined}
                                onClick={() => void syncVideo(b.id, p)}
                                className="flex-1 rounded-lg border border-[#FF7E00]/30 bg-[#FF7E00]/10 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/85 disabled:opacity-35"
                              >
                                Sync {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setInviteOpen((o) => !o)}
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/75"
          >
            {inviteOpen ? "Hide booking invite" : "Send booking invite"}
          </button>
          {inviteOpen ? (
            <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <label className="block text-[10px] font-bold uppercase text-white/40">Start</label>
              <input
                type="datetime-local"
                value={inviteStart}
                onChange={(e) => setInviteStart(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
              />
              <label className="block text-[10px] font-bold uppercase text-white/40">End</label>
              <input
                type="datetime-local"
                value={inviteEnd}
                onChange={(e) => setInviteEnd(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
              />
              <label className="block text-[10px] font-bold uppercase text-white/40">Note (optional)</label>
              <input
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-2 py-2 text-xs text-white"
                maxLength={500}
              />
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void sendBookingInvite()}
                className="w-full rounded-lg border border-emerald-400/35 bg-emerald-500/12 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-100 disabled:opacity-40"
              >
                {inviteBusy ? "Sending…" : "Send invite to chat"}
              </button>
            </div>
          ) : null}
          {phoneCall?.paid && phoneCall.twilioConfigured && !phoneCall.ready ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-50/90">
              <span className="font-bold uppercase tracking-[0.08em] text-amber-200/90">Masked calls </span>
              Both sides must opt in under{" "}
              <Link href="/trainer/dashboard/settings" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                Account Settings → Masked calls &amp; phone privacy
              </Link>
              .
            </div>
          ) : null}
          {phoneCall?.paid && !phoneCall.twilioConfigured ? (
            <p className="text-[11px] text-white/45">Masked calling is not enabled on this server yet.</p>
          ) : null}
          {!phoneCall?.paid && phoneCall?.twilioConfigured ? (
            <p className="text-[11px] text-white/45">Voice and synced video unlock after this client completes a paid checkout with you.</p>
          ) : null}
          {voiceCallEnabled ? (
            <button
              type="button"
              disabled={callBusy}
              onClick={() => void startMaskedCallTrainer()}
              className="w-full rounded-lg border border-sky-400/35 bg-sky-500/12 py-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-100 disabled:opacity-40"
            >
              {callBusy ? "Calling…" : "Start masked call"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-3 sm:flex-row sm:items-stretch">
        {official && !archived && trainerPremiumStudio ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setPlusOpen((o) => !o)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/15 text-xl font-light leading-none text-white shadow-inner transition hover:border-[#FF7E00]/50"
              aria-expanded={plusOpen}
              aria-haspopup="true"
              title="Share from Premium"
            >
              +
            </button>
            {plusOpen ? (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-white/10 bg-[#151925] p-2 shadow-2xl">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">FitHub post</p>
                <div className="max-h-48 overflow-y-auto">
                  {shareableFitHubPosts.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-white/45">No public posts yet.</p>
                  ) : (
                    shareableFitHubPosts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={Boolean(sendingPostId)}
                        onClick={() => void shareFitHubPost(p.id)}
                        className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-xs text-white/80 hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <span className="line-clamp-2">{p.preview}</span>
                        <span className="text-[10px] text-white/35">{p.postType}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-1 border-t border-white/[0.06] pt-2">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg px-2 py-2 text-left text-xs text-white/35"
                    title="Coming soon"
                  >
                    Reviews (coming soon)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!official || archived}
          placeholder={
            archived
              ? "Archived — messaging is paused."
              : official
                ? "Write a message…"
                : "Chat opens after the thread is active."
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
          <span className="font-semibold uppercase tracking-[0.08em] text-white/42">TRAINER REMINDER: </span>
          <span className="break-words">{OFF_PLATFORM_LIQUIDATED_DAMAGES_NOTICE}</span>
        </div>
      ) : null}
    </div>
  );
}
