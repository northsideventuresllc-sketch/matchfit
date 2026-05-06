"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientFithubPrefs } from "@/lib/client-fithub-prefs";
import {
  FITHUB_CONTENT_REPORT_CATEGORIES,
  FITHUB_CONTENT_REPORT_CATEGORY_LABELS,
  type FitHubContentReportCategory,
} from "@/lib/fithub-content-report-categories";

type FeedComment = {
  id: string;
  createdAt: string;
  body: string;
  isMine: boolean;
  authorLabel: string;
};

type FeedPost = {
  id: string;
  createdAt: string;
  postType: string;
  caption: string | null;
  bodyText: string | null;
  mediaUrl: string | null;
  mediaUrls?: string[];
  hashtags?: string[];
  shareCount: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  reportedByMe?: boolean;
  counts: { likes: number; comments: number; reposts: number };
  trainer: { username: string; displayName: string; profileImageUrl: string | null };
  comments: FeedComment[];
};

export function ClientFitHubFeedClient() {
  const [prefs, setPrefs] = useState<ClientFithubPrefs | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [swipeHint, setSwipeHint] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<FeedPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/fithub/feed");
      const data = (await res.json()) as {
        posts?: FeedPost[];
        preferences?: ClientFithubPrefs;
        feedEmptyReason?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load FitHub.");
        setPosts([]);
        return;
      }
      setPrefs(data.preferences ?? null);
      setPosts(data.posts ?? []);
      setEmptyReason(data.feedEmptyReason ?? null);
    } catch {
      setError("Network error.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function toggleLike(p: FeedPost) {
    const res = await fetch(`/api/client/fithub/posts/${encodeURIComponent(p.id)}/like`, { method: "POST" });
    const data = (await res.json()) as { liked?: boolean; likeCount?: number; error?: string };
    if (!res.ok) return;
    setPosts((list) =>
      list?.map((x) =>
        x.id === p.id
          ? {
              ...x,
              likedByMe: Boolean(data.liked),
              counts: { ...x.counts, likes: data.likeCount ?? x.counts.likes },
            }
          : x,
      ) ?? null,
    );
  }

  async function toggleRepost(p: FeedPost) {
    const res = await fetch(`/api/client/fithub/posts/${encodeURIComponent(p.id)}/repost`, { method: "POST" });
    const data = (await res.json()) as { reposted?: boolean; repostCount?: number; error?: string };
    if (!res.ok) return;
    setPosts((list) =>
      list?.map((x) =>
        x.id === p.id
          ? {
              ...x,
              repostedByMe: Boolean(data.reposted),
              counts: { ...x.counts, reposts: data.repostCount ?? x.counts.reposts },
            }
          : x,
      ) ?? null,
    );
  }

  async function sharePost(p: FeedPost) {
    const res = await fetch(`/api/client/fithub/posts/${encodeURIComponent(p.id)}/share`, { method: "POST" });
    const data = (await res.json()) as { shareCount?: number };
    if (res.ok && typeof data.shareCount === "number") {
      setPosts((list) =>
        list?.map((x) => (x.id === p.id ? { ...x, shareCount: data.shareCount! } : x)) ?? null,
      );
    }
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/trainers/${encodeURIComponent(p.trainer.username)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${p.trainer.displayName} on Match Fit`,
          text: p.caption ?? p.bodyText ?? "Check out this coach on Match Fit.",
          url,
        });
      }
    } catch {
      /* user cancelled or unsupported */
    }
  }

  async function submitComment(postId: string) {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const res = await fetch(`/api/client/fithub/posts/${encodeURIComponent(postId)}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = (await res.json()) as {
      comment?: FeedComment;
      commentCount?: number;
      error?: string;
    };
    if (!res.ok) return;
    setCommentDrafts((d) => ({ ...d, [postId]: "" }));
    setPosts((list) =>
      list?.map((x) =>
        x.id === postId
          ? {
              ...x,
              comments: [...x.comments, ...(data.comment ? [data.comment] : [])],
              counts: { ...x.counts, comments: data.commentCount ?? x.counts.comments + 1 },
            }
          : x,
      ) ?? null,
    );
  }

  if (loading && !posts) {
    return <p className="py-16 text-left text-sm text-white/45">Loading FitHub…</p>;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  if (emptyReason === "SAVED_COACHES_ONLY") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 px-4 py-10 text-left">
        <p className="text-sm text-white/60">
          Your feed is set to <span className="text-white/90">saved coaches only</span>, but you have not saved any
          coaches yet. Save coaches from discovery or loosen this filter in{" "}
          <Link href="/client/dashboard/fithub-settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            FitHub settings
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!posts?.length) {
    return <p className="py-16 text-left text-sm text-white/45">No posts match your filters yet.</p>;
  }

  return (
    <div className="space-y-8">
      {reportTarget ? (
        <FitHubReportModal
          post={reportTarget}
          onClose={() => setReportTarget(null)}
          onDone={(message) => {
            setReportTarget(null);
            setSwipeHint(message);
            window.setTimeout(() => setSwipeHint(null), 4200);
          }}
          onMarkReported={(postId) => {
            setPosts((list) =>
              list?.map((x) => (x.id === postId ? { ...x, reportedByMe: true } : x)) ?? null,
            );
          }}
        />
      ) : null}
      {swipeHint ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-100">
          {swipeHint}
        </p>
      ) : null}
      {posts.map((p) => (
        <FitHubPostCard
          key={p.id}
          post={p}
          autoplayVideo={Boolean(prefs?.autoplayVideo)}
          commentDraft={commentDrafts[p.id] ?? ""}
          onCommentDraft={(v) => setCommentDrafts((d) => ({ ...d, [p.id]: v }))}
          commentsOpen={Boolean(openComments[p.id])}
          onToggleComments={() => setOpenComments((o) => ({ ...o, [p.id]: !o[p.id] }))}
          onLike={() => void toggleLike(p)}
          onRepost={() => void toggleRepost(p)}
          onShare={() => void sharePost(p)}
          onSubmitComment={() => void submitComment(p.id)}
          onReport={() => setReportTarget(p)}
          onSavedCoach={(msg) => {
            setSwipeHint(msg);
            window.setTimeout(() => setSwipeHint(null), 3200);
          }}
          onMutedFromFeed={() => void load()}
        />
      ))}
    </div>
  );
}

function FitHubPostCard(props: {
  post: FeedPost;
  autoplayVideo: boolean;
  commentDraft: string;
  onCommentDraft: (v: string) => void;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onSubmitComment: () => void;
  onReport: () => void;
  onSavedCoach: (message: string) => void;
  onMutedFromFeed?: () => void;
}) {
  const { post: p } = props;
  const feedMenuRef = useRef<HTMLDetailsElement | null>(null);
  const startX = useRef<number | null>(null);
  const tracking = useRef(false);
  const suppressAvatarLinkNav = useRef(false);

  async function trySaveCoach(deltaX: number) {
    if (deltaX < 72) return;
    const res = await fetch("/api/client/saved-trainers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerUsername: p.trainer.username }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      props.onSavedCoach(data.error ?? "Could not save this coach.");
      return;
    }
    props.onSavedCoach(`Saved @${p.trainer.username} to your coaches.`);
  }

  async function muteCoachInFithubOnly() {
    const res = await fetch("/api/safety/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUsername: p.trainer.username,
        targetIsTrainer: true,
        blockMode: "fithub_only",
      }),
    });
    if (res.ok) {
      feedMenuRef.current?.removeAttribute("open");
      props.onMutedFromFeed?.();
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/95 text-left shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/trainers/${encodeURIComponent(p.trainer.username)}`}
            aria-label={`${p.trainer.displayName} profile`}
            title="View profile · swipe right on avatar to save coach"
            className="relative h-14 w-14 shrink-0 cursor-pointer touch-pan-y overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[#0E1016] outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
            onClick={(e) => {
              if (suppressAvatarLinkNav.current) {
                e.preventDefault();
                suppressAvatarLinkNav.current = false;
              }
            }}
            onPointerDown={(e) => {
              tracking.current = true;
              startX.current = e.clientX;
              if (e.currentTarget instanceof HTMLElement) {
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
              }
            }}
            onPointerUp={(e) => {
              if (!tracking.current || startX.current == null) return;
              tracking.current = false;
              const dx = e.clientX - startX.current;
              startX.current = null;
              if (dx >= 72) {
                suppressAvatarLinkNav.current = true;
              }
              void trySaveCoach(dx);
            }}
            onPointerCancel={() => {
              tracking.current = false;
              startX.current = null;
            }}
          >
            {p.trainer.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.trainer.profileImageUrl.split("?")[0]} alt="" className="pointer-events-none h-full w-full object-cover" />
            ) : (
              <span className="pointer-events-none flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                {p.trainer.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/trainers/${encodeURIComponent(p.trainer.username)}`}
              className="block truncate text-sm font-bold text-white/95 hover:text-[#FF7E00]"
            >
              {p.trainer.displayName}
            </Link>
            <Link
              href={`/trainers/${encodeURIComponent(p.trainer.username)}`}
              className="mt-0.5 block truncate text-[10px] font-medium leading-tight tracking-wide text-white/42 hover:text-[#FF7E00]/90"
            >
              @{p.trainer.username}
            </Link>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">Swipe right on the avatar to save coach</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wide text-white/35">{p.postType}</span>
        </div>
      </div>

      <div className="px-4 py-4">
        {p.caption ? <p className="text-sm font-semibold text-white/90">{p.caption}</p> : null}
        {p.bodyText ? (
          <p className={`text-sm leading-relaxed text-white/70 ${p.caption ? "mt-2" : ""}`}>{p.bodyText}</p>
        ) : null}

        {p.postType === "IMAGE" && p.mediaUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.mediaUrl} alt="" className="max-h-[28rem] w-full object-cover" />
          </div>
        ) : null}

        {p.postType === "VIDEO" && p.mediaUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              src={p.mediaUrl}
              className="max-h-[28rem] w-full"
              controls
              playsInline
              muted={props.autoplayVideo}
              autoPlay={props.autoplayVideo}
              loop={props.autoplayVideo}
            />
          </div>
        ) : null}

        {p.postType === "CAROUSEL" && (p.mediaUrls?.length ?? 0) > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-2 pb-3">
            {(p.mediaUrls ?? []).map((u, i) => (
              <div key={`${p.id}-c-${i}`} className="h-64 w-52 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {u.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                  <video src={u} className="h-full w-full object-cover" controls playsInline muted={!props.autoplayVideo} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {(p.hashtags?.length ?? 0) > 0 ? (
          <p className="mt-3 text-xs font-semibold text-[#FF7E00]/85">
            {(p.hashtags ?? []).map((h) => (
              <span key={h} className="mr-2">
                #{h}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-3">
        <button
          type="button"
          onClick={props.onLike}
          className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${
            p.likedByMe ? "bg-[#FF7E00]/20 text-[#FF7E00]" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          Like · {p.counts.likes}
        </button>
        <button
          type="button"
          onClick={props.onToggleComments}
          className="rounded-xl bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/60 transition hover:bg-white/[0.08]"
        >
          Comment · {p.counts.comments}
        </button>
        <button
          type="button"
          onClick={props.onRepost}
          className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${
            p.repostedByMe ? "bg-emerald-500/15 text-emerald-200" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          Repost · {p.counts.reposts}
        </button>
        <button
          type="button"
          onClick={props.onShare}
          className="rounded-xl bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/60 transition hover:bg-white/[0.08]"
        >
          Share · {p.shareCount}
        </button>
        <button
          type="button"
          onClick={props.onReport}
          disabled={Boolean(p.reportedByMe)}
          className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${
            p.reportedByMe
              ? "cursor-not-allowed bg-white/[0.02] text-white/25"
              : "bg-white/[0.04] text-white/50 hover:bg-[#E32B2B]/10 hover:text-[#FFB4B4]"
          }`}
        >
          {p.reportedByMe ? "Reported" : "Report"}
        </button>
        <details ref={feedMenuRef} className="relative">
          <summary className="cursor-pointer list-none rounded-xl bg-white/[0.04] px-2.5 py-2 text-[10px] font-black uppercase tracking-wide text-white/35 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-white/[0.08] hover:text-white/55">
            ···
          </summary>
          <div className="absolute bottom-full right-0 z-20 mb-1 w-48 rounded-xl border border-white/10 bg-[#12151C] py-1 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void muteCoachInFithubOnly();
              }}
              className="block w-full px-3 py-2 text-left text-[11px] text-white/70 hover:bg-white/[0.05]"
            >
              Hide coach in FitHub
            </button>
          </div>
        </details>
      </div>

      {props.commentsOpen ? (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {p.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs font-bold text-[#FF7E00]/90">{c.authorLabel}</span>
                <p className="mt-0.5 text-white/75">{c.body}</p>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={props.commentDraft}
              onChange={(e) => props.onCommentDraft(e.target.value)}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
            />
            <button
              type="button"
              onClick={props.onSubmitComment}
              className="shrink-0 rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0B0C0F]"
            >
              Post
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FitHubReportModal(props: {
  post: FeedPost;
  onClose: () => void;
  onDone: (message: string) => void;
  onMarkReported: (postId: string) => void;
}) {
  const [category, setCategory] = useState<FitHubContentReportCategory>("safety_violation");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/fithub/posts/${encodeURIComponent(props.post.id)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, details }),
      });
      const data = (await res.json()) as { error?: string; message?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not submit.");
        return;
      }
      props.onMarkReported(props.post.id);
      props.onDone(data.message ?? "Thanks — your report was submitted.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const p = props.post;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fithub-report-title"
      onClick={props.onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#12151C] p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fithub-report-title" className="text-lg font-black uppercase tracking-wide text-white/95">
          Report post
        </h2>
        <p className="mt-2 text-sm text-white/55">
          Reports help us enforce community standards: safety, accurate health and fitness information, respect, and
          compliance with typical social posting rules. False reports may limit your account.
        </p>
        <p className="mt-3 truncate text-xs text-white/40">
          Post by <span className="text-white/70">{p.trainer.displayName}</span> (
          <Link
            href={`/trainers/${encodeURIComponent(p.trainer.username)}`}
            className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
          >
            @{p.trainer.username}
          </Link>
          )
        </p>

        <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-white/45">
          Reason
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FitHubContentReportCategory)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2.5 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
          >
            {FITHUB_CONTENT_REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FITHUB_CONTENT_REPORT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-white/45">
          {category === "other" ? "Describe the issue (required)" : "Additional context (optional)"}
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={
              category === "other"
                ? "What happened? Include timestamps or what stood out."
                : "Optional: quote the part of the post that concerns you."
            }
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/70 transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0B0C0F] disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
