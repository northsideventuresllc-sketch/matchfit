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
  scheduledPublishAt: string | null;
  visibility: string;
  isScheduled: boolean;
};

export function TrainerPremiumMyContentClient() {
  const router = useRouter();
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyPost | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, postsRes] = await Promise.all([
        fetch("/api/trainer/me"),
        fetch("/api/trainer/fithub/my-posts"),
      ]);
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
      <p className="text-center text-xs text-white/45">
        <Link href="/trainer/dashboard/premium/studio" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to Premium Studio
        </Link>
      </p>

      {!posts?.length ? (
        <p className="py-10 text-center text-sm text-white/45">No posts yet. Create one from Premium Studio.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setDetail(p)}
                className="w-full rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 px-4 py-3 text-left transition hover:border-white/15"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-[#FF7E00]/90">{p.postType}</span>
                  <span className="text-[10px] uppercase tracking-wide text-white/35">
                    {p.isScheduled ? "Scheduled" : p.visibility === "PRIVATE" ? "Private" : "Live"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-white/80">{p.caption || p.bodyText || "(Media post)"}</p>
                {p.scheduledPublishAt ? (
                  <p className="mt-1 text-[10px] text-white/40">Goes live: {new Date(p.scheduledPublishAt).toLocaleString()}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

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
            <p className="mt-3 text-[10px] text-white/35">Shares recorded: {detail.shareCount}</p>

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
