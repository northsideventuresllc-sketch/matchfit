"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminLoadingBar,
  AdminPortalAlert,
  adminCardClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { describePendingPost } from "@/lib/content-calendar/pending-schedule";
import { defaultPlatformsForPost, postTypeIcon } from "../v2/components/helpers";
import { Modal } from "../v2/components/ui-bits";

const CAPTION_PREVIEW_LENGTH = 220;

function captionPreview(caption: string): string {
  const clean = caption.replace(/\s+/g, " ").trim();
  if (!clean) return "No words written yet.";
  if (clean.length <= CAPTION_PREVIEW_LENGTH) return clean;
  return `${clean.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()}…`;
}

/** "Monday, Jul 27" from a YYYY-MM-DD date, or a plain fallback. */
function plainPostDate(postDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postDate)) return "No day set yet";
  const parsed = new Date(`${postDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "No day set yet";
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function PendingCard({
  post,
  now,
  busy,
  onSendBack,
}: {
  post: ClientContentCalendarV2Post;
  now: Date;
  busy: boolean;
  onSendBack: (post: ClientContentCalendarV2Post) => void;
}) {
  const view = describePendingPost(
    {
      postType: post.postType,
      mediaStatus: post.mediaStatus,
      mediaUrls: post.mediaUrls,
      scheduledAt: post.scheduledAt,
    },
    now,
  );
  const platforms = defaultPlatformsForPost(post);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {postTypeIcon(post.postType)} {post.postType} · {plainPostDate(post.postDate)}
          </p>

          <div className="mt-3 space-y-1.5 text-sm text-white/80">
            <p>
              <span className="font-bold text-white">Pictures:</span> {view.mediaLine}
            </p>
            <p>
              <span className="font-bold text-white">Goes out:</span> {view.postLine}
              {view.postTimeIsExact ? (
                <span className="ml-1 text-white/45">(you picked this time)</span>
              ) : null}
            </p>
          </div>

          <p className="mt-3 text-xs uppercase tracking-wide text-white/40">Goes to</p>
          <p className="text-sm text-white/70">{platforms.length ? platforms.join(", ") : "No places picked yet"}</p>

          <p className="mt-3 text-xs uppercase tracking-wide text-white/40">What it says</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-white/65">
            {captionPreview(post.caption)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span
            className={
              view.mediaReady
                ? "rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-300"
                : "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
            }
          >
            {view.mediaBadge}
          </span>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={() => onSendBack(post)}
          >
            {busy ? "Sending Back…" : "Send Back To Drafts"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ContentPendingClient() {
  const [posts, setPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ClientContentCalendarV2Post | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/pending", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        posts?: ClientContentCalendarV2Post[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load the posts that are waiting to go out.");
      setPosts(data.posts ?? []);
      setNow(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the posts that are waiting to go out.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  // Keep the wording honest as slots pass — "tonight at 7:15pm" must not still say that at 8pm.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sendBack = useCallback(
    async (post: ClientContentCalendarV2Post) => {
      setBusyId(post.id);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch("/api/admin/content-calendar/v2/pending/back-to-drafts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not send that post back to drafts.");
        setNotice(`That ${post.postType.toLowerCase()} post is back in your drafts. Your pictures were kept.`);
        setConfirming(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send that post back to drafts.");
        setConfirming(null);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const readyCount = posts.filter(
    (p) =>
      describePendingPost(
        { postType: p.postType, mediaStatus: p.mediaStatus, mediaUrls: p.mediaUrls, scheduledAt: p.scheduledAt },
        now,
      ).mediaReady,
  ).length;

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="6xl"
      title="Pending Posts"
      description="Everything you have approved that has not gone out yet, with the day and time it happens. Send anything back to drafts if you want to change it first."
      contentClassName="space-y-6"
      headerActions={
        <>
          <Link href="/admin/content-calendar/v2" className={adminSecondaryButtonClass}>
            Back To Content Calendar
          </Link>
          <button type="button" className={adminPrimaryButtonClass} disabled={loading} onClick={() => void load()}>
            {loading ? "Checking…" : "Refresh"}
          </button>
        </>
      }
    >
      {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}
      {notice ? <AdminPortalAlert variant="success">{notice}</AdminPortalAlert> : null}

      <section className={adminCardClass}>
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Waiting to go out</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          {posts.length === 0
            ? "Nothing is waiting right now."
            : `${posts.length} post${posts.length === 1 ? "" : "s"} waiting · ${readyCount} ready to go · ${posts.length - readyCount} still need pictures.`}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          Pictures get made at 8:30am, 4:15pm and 7:15pm, Monday to Friday. Posts go out at 5pm and 8pm, Monday to
          Friday. Nothing happens at the weekend.
        </p>
      </section>

      {loading ? <AdminLoadingBar label="Checking what is waiting…" /> : null}

      <div className="space-y-3">
        {posts.map((post) => (
          <PendingCard
            key={post.id}
            post={post}
            now={now}
            busy={busyId === post.id}
            onSendBack={setConfirming}
          />
        ))}
      </div>

      {!loading && !posts.length ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
          Nothing is waiting to go out. Approve a day in the Content Calendar and it will show up here.
        </div>
      ) : null}

      {confirming ? (
        <Modal title="Send this back to drafts?" onClose={() => setConfirming(null)}>
          <p className="text-sm leading-relaxed text-white/80">
            This takes the {confirming.postType.toLowerCase()} post for {plainPostDate(confirming.postDate)} out of the
            batch so it will not go out. It goes back to your drafts where you can edit it.
          </p>
          <p className="mt-2 text-xs text-white/50">Any pictures already made stay attached to it.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setConfirming(null)}>
              Keep It In
            </button>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={busyId === confirming.id}
              onClick={() => void sendBack(confirming)}
            >
              {busyId === confirming.id ? "Sending Back…" : "Send Back To Drafts"}
            </button>
          </div>
        </Modal>
      ) : null}
    </AdminPortalShell>
  );
}
