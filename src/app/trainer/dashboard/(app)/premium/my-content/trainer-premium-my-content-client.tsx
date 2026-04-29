"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MyPost = {
  id: string;
  createdAt: string;
  postType: string;
  caption: string | null;
  bodyText: string | null;
  mediaUrl: string | null;
  mediaUrls: string[];
  hashtags: string[];
  shareCount: number;
  likeCount?: number;
  commentCount?: number;
  repostCount?: number;
  recordedShareCount?: number;
  scheduledPublishAt: string | null;
  visibility: string;
  isScheduled: boolean;
};

type MyContentProps = {
  /** When true, hides the top nav link (used on the combined FitHub & content page). */
  embedded?: boolean;
};

type CommentRow = { id: string; createdAt: string; body: string; authorLabel: string };

function firstThumb(p: MyPost): string | null {
  if (p.mediaUrl?.trim()) return p.mediaUrl;
  if (p.mediaUrls[0]) return p.mediaUrls[0];
  return null;
}

function isVideoUrl(u: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(u);
}

function statusBadge(p: MyPost): { label: string; className: string } {
  if (p.isScheduled) return { label: "SCHEDULED", className: "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/35" };
  if (p.visibility === "PRIVATE") return { label: "PRIVATE", className: "bg-white/10 text-white/60 ring-1 ring-white/15" };
  return { label: "LIVE", className: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/35" };
}

export function TrainerPremiumMyContentClient(props: MyContentProps) {
  const embedded = Boolean(props.embedded);
  const router = useRouter();
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyPost | null>(null);
  const [busy, setBusy] = useState(false);

  const [commentsPost, setCommentsPost] = useState<MyPost | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsErr, setCommentsErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, postsRes] = await Promise.all([fetch("/api/trainer/me"), fetch("/api/trainer/fithub/my-posts")]);
      const me = (await meRes.json()) as { username?: string; error?: string };
      const data = (await postsRes.json()) as { posts?: MyPost[]; error?: string };
      if (meRes.ok && me.username) setUsername(me.username);
      if (!postsRes.ok) {
        setError(data.error ?? "Could not load content.");
        setPosts([]);
        return;
      }
      setPosts(data.posts ?? []);
    } catch {
      setError("Network error.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openComments = useCallback(async (post: MyPost) => {
    setCommentsPost(post);
    setComments([]);
    setCommentsErr(null);
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/trainer/fithub/posts/${encodeURIComponent(post.id)}/comments`, { cache: "no-store" });
      const j = (await res.json()) as { comments?: CommentRow[]; error?: string };
      if (!res.ok) {
        setCommentsErr(j.error ?? "Could not load comments.");
        return;
      }
      setComments(j.comments ?? []);
    } catch {
      setCommentsErr("Network error.");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  async function setPrivate(post: MyPost, next: "PUBLIC" | "PRIVATE") {
    setBusy(true);
    try {
      const res = await fetch(`/api/trainer/fithub/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) return;
      setPosts((list) => list?.map((p) => (p.id === post.id ? { ...p, visibility: next } : p)) ?? null);
      setDetail((d) => (d && d.id === post.id ? { ...d, visibility: next } : d));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removePost(post: MyPost) {
    if (!window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trainer/fithub/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      if (!res.ok) return;
      setPosts((list) => list?.filter((p) => p.id !== post.id) ?? null);
      setDetail((d) => (d?.id === post.id ? null : d));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sharePost(post: MyPost) {
    setBusy(true);
    try {
      const res = await fetch(`/api/trainer/fithub/posts/${encodeURIComponent(post.id)}/share`, { method: "POST" });
      const data = (await res.json()) as { shareCount?: number };
      if (res.ok && typeof data.shareCount === "number") {
        setPosts((list) => list?.map((p) => (p.id === post.id ? { ...p, shareCount: data.shareCount! } : p)) ?? null);
        setDetail((d) => (d && d.id === post.id ? { ...d, shareCount: data.shareCount! } : d));
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const profileUrl = `${origin}/trainers/${encodeURIComponent(username || "_")}`;
      const text = post.caption ?? post.bodyText ?? "View my Match Fit profile.";
      try {
        if (navigator.share) {
          await navigator.share({ title: "Match Fit", text, url: profileUrl });
        }
      } catch {
        /* cancelled */
      }
    } finally {
      setBusy(false);
    }
  }

  const likes = (p: MyPost) => p.likeCount ?? 0;
  const commentsN = (p: MyPost) => p.commentCount ?? 0;
  const reposts = (p: MyPost) => p.repostCount ?? 0;
  const shares = (p: MyPost) => p.shareCount ?? 0;

  if (loading && !posts) {
    return <p className="py-12 text-center text-sm text-white/45">Loading your content…</p>;
  }
  if (error && !posts?.length) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <p className="text-center text-xs text-white/45">
          <Link href="/trainer/dashboard/premium/fit-hub-content" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Back to FitHub &amp; Content
          </Link>
        </p>
      ) : null}

      {!posts?.length ? (
        <p className="py-10 text-center text-sm text-white/45">
          No posts yet. Use the composer above to create your first FitHub post.
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => {
            const thumb = firstThumb(p);
            const st = statusBadge(p);
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.85)]"
              >
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch">
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:h-auto sm:w-36">
                    {thumb ? (
                      isVideoUrl(thumb) ? (
                        <video src={thumb} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-full min-h-[7rem] items-center justify-center text-[10px] font-bold uppercase tracking-wide text-white/25">
                        {p.postType}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#FF7E00]/90">{p.postType}</span>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetail(p)}
                      className="block w-full text-left text-sm font-semibold text-white/85 hover:text-white"
                    >
                      {p.caption || p.bodyText || "(Media post)"}
                    </button>
                    {p.scheduledPublishAt ? (
                      <p className="text-[10px] text-white/40">Goes live: {new Date(p.scheduledPublishAt).toLocaleString()}</p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-100/95">
                        <span aria-hidden>♥</span>
                        {likes(p)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void openComments(p)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold text-sky-100/95 transition hover:border-sky-400/50"
                      >
                        Comments <span className="tabular-nums">{commentsN(p)}</span>
                      </button>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-50/95">
                        Shares <span className="tabular-nums">{shares(p)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold text-violet-100/95">
                        Reposts <span className="tabular-nums">{reposts(p)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {commentsPost ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setCommentsPost(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setCommentsPost(null);
          }}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#12151C] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-white/90">Comments</h2>
                <p className="mt-1 line-clamp-2 text-xs text-white/45">{commentsPost.caption || commentsPost.bodyText || "(Post)"}</p>
              </div>
              <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => setCommentsPost(null)}>
                Close
              </button>
            </div>
            <div className="max-h-[min(70vh,26rem)] overflow-y-auto px-4 py-3">
              {commentsErr ? <p className="text-sm text-[#FFB4B4]">{commentsErr}</p> : null}
              {commentsLoading ? <p className="py-8 text-center text-sm text-white/45">Loading…</p> : null}
              {!commentsLoading && !comments.length && !commentsErr ? (
                <p className="py-8 text-center text-sm text-white/45">No comments on this post yet.</p>
              ) : null}
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white/85">{c.authorLabel}</span>
                      <span className="text-[10px] text-white/35">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/70">{c.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-black/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDetail(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#12151C] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-black uppercase tracking-wide text-white/90">Your post</h2>
              <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-white/35">
              {detail.postType} · {detail.isScheduled ? "Scheduled" : detail.visibility === "PRIVATE" ? "Private" : "Public on FitHub"}
            </p>
            {detail.caption ? <p className="mt-3 text-sm font-semibold text-white/90">{detail.caption}</p> : null}
            {detail.bodyText ? <p className="mt-2 text-sm text-white/70">{detail.bodyText}</p> : null}
            {detail.hashtags.length ? (
              <p className="mt-2 text-xs text-[#FF7E00]/90">
                {detail.hashtags.map((h) => (
                  <span key={h} className="mr-2">
                    #{h}
                  </span>
                ))}
              </p>
            ) : null}
            {detail.mediaUrl && detail.postType !== "CAROUSEL" ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                {detail.postType === "VIDEO" ? (
                  <video src={detail.mediaUrl} className="max-h-64 w-full" controls playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.mediaUrl} alt="" className="max-h-64 w-full object-cover" />
                )}
              </div>
            ) : null}
            {detail.postType === "CAROUSEL" && detail.mediaUrls.length ? (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {detail.mediaUrls.map((u, i) => (
                  <div key={`${u}-${i}`} className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-white/10">
                    {u.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                      <video src={u} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
              <span className="rounded-md bg-white/[0.06] px-2 py-1">♥ {likes(detail)}</span>
              <button
                type="button"
                className="rounded-md bg-white/[0.06] px-2 py-1 text-[#FF7E00] underline-offset-2 hover:underline"
                onClick={() => {
                  setDetail(null);
                  void openComments(detail);
                }}
              >
                Comments {commentsN(detail)}
              </button>
              <span className="rounded-md bg-white/[0.06] px-2 py-1">Shares {shares(detail)}</span>
              <span className="rounded-md bg-white/[0.06] px-2 py-1">Reposts {reposts(detail)}</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void sharePost(detail)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/[0.06]"
              >
                Share
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void setPrivate(detail, detail.visibility === "PRIVATE" ? "PUBLIC" : "PRIVATE")}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/[0.06]"
              >
                {detail.visibility === "PRIVATE" ? "Make public" : "Make private"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePost(detail)}
                className="rounded-xl border border-[#E32B2B]/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
