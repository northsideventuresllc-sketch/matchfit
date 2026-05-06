"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TRAINER_FITHUB_PREFS_STORAGE_KEY,
  defaultTrainerFithubPrefs,
  normalizeTrainerFithubPrefs,
  type TrainerFithubPrefs,
} from "@/lib/trainer-fithub-prefs";

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
  counts: { likes: number; comments: number; reposts: number };
  trainer: { id: string; username: string; displayName: string; profileImageUrl: string | null };
};

function TrainerFithubOtherCoachMenu(props: { otherUsername: string; onMuted: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function mute() {
    setBusy(true);
    try {
      const res = await fetch("/api/safety/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: props.otherUsername,
          targetIsTrainer: true,
          blockMode: "trainer_fithub_mute",
        }),
      });
      if (res.ok) {
        setOpen(false);
        props.onMuted();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-white/[0.08] px-1.5 py-0.5 text-xs text-white/35 hover:text-white/60 disabled:opacity-40"
        aria-expanded={open}
        title="More"
      >
        ···
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-white/10 bg-[#12151C] py-1 shadow-xl">
          <button
            type="button"
            disabled={busy}
            onClick={() => void mute()}
            className="block w-full px-3 py-2 text-left text-[11px] text-white/70 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Hide in my FitHub
          </button>
        </div>
      ) : null}
    </div>
  );
}

function scorePost(p: FeedPost): number {
  const ageH = (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
  const engagement = p.counts.likes * 2 + p.counts.comments * 3 + p.counts.reposts * 4 + p.shareCount;
  return engagement + Math.max(0, 72 - ageH);
}

function dedupeByTrainer(posts: FeedPost[], enabled: boolean): FeedPost[] {
  if (!enabled) return posts;
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const p of posts) {
    if (seen.has(p.trainer.id)) continue;
    seen.add(p.trainer.id);
    out.push(p);
  }
  return out;
}

export function TrainerFitHubFeedClient() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<TrainerFithubPrefs>({ ...defaultTrainerFithubPrefs });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRAINER_FITHUB_PREFS_STORAGE_KEY);
      if (raw) setPrefs(normalizeTrainerFithubPrefs(JSON.parse(raw) as unknown));
    } catch {
      /* ignore */
    }
  }, []);

  const [viewerTrainerId, setViewerTrainerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/fithub/feed");
      const data = (await res.json()) as { posts?: FeedPost[]; viewerTrainerId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load FitHub.");
        setPosts([]);
        return;
      }
      if (typeof data.viewerTrainerId === "string") setViewerTrainerId(data.viewerTrainerId);
      setPosts(data.posts ?? []);
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

  const visiblePosts = useMemo(() => {
    const base = posts ?? [];
    const types = new Set<string>();
    if (prefs.showTextPosts) types.add("TEXT");
    if (prefs.showImagePosts) {
      types.add("IMAGE");
      types.add("CAROUSEL");
    }
    if (prefs.showVideoPosts) types.add("VIDEO");
    if (!types.size) types.add("TEXT");
    const filtered = base.filter((p) => types.has(p.postType));
    const sorted = [...filtered];
    if (prefs.feedStyle === "NEWEST") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      sorted.sort((a, b) => scorePost(b) - scorePost(a));
    }
    return dedupeByTrainer(sorted, prefs.hideRepeatedTrainers);
  }, [posts, prefs]);

  if (loading && !posts) {
    return <p className="py-16 text-center text-sm text-white/45">Loading FitHub…</p>;
  }
  if (error) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }
  if (!visiblePosts.length) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 px-4 py-10 text-center">
        <p className="text-sm text-white/60">
          No posts match your filters. Adjust your{" "}
          <Link href="/trainer/dashboard/fit-hub-settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            FitHub Settings
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {visiblePosts.map((p) => (
        <article
          key={p.id}
          className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/95 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)]"
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[#0E1016]">
                {p.trainer.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.trainer.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                    {p.trainer.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/trainers/${encodeURIComponent(p.trainer.username)}`}
                  className="truncate text-sm font-bold text-white/95 hover:text-[#FF7E00]"
                >
                  {p.trainer.displayName}
                </Link>
                <p className="truncate text-xs text-white/40">@{p.trainer.username}</p>
              </div>
              {viewerTrainerId && p.trainer.id !== viewerTrainerId ? (
                <TrainerFithubOtherCoachMenu
                  otherUsername={p.trainer.username}
                  onMuted={() => void load()}
                />
              ) : null}
              <span className="text-[10px] font-black uppercase tracking-wide text-white/35">{p.postType}</span>
            </div>
          </div>

          <div className="px-4 py-4">
            {p.caption ? <p className="text-sm font-semibold text-white/90">{p.caption}</p> : null}
            {p.bodyText ? <p className={`text-sm leading-relaxed text-white/70 ${p.caption ? "mt-2" : ""}`}>{p.bodyText}</p> : null}
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
                  muted={prefs.autoplayVideo}
                  autoPlay={prefs.autoplayVideo}
                  loop={prefs.autoplayVideo}
                />
              </div>
            ) : null}
            {p.postType === "CAROUSEL" && (p.mediaUrls?.length ?? 0) > 0 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-2 pb-3">
                {(p.mediaUrls ?? []).map((u, i) => (
                  <div
                    key={`${p.id}-c-${i}`}
                    className="h-64 w-52 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40"
                  >
                    {u.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                      <video src={u} className="h-full w-full object-cover" controls playsInline muted={!prefs.autoplayVideo} />
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

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-3 text-[10px] font-black uppercase tracking-wide text-white/55">
            <span className="rounded-xl bg-white/[0.04] px-3 py-2">Likes · {p.counts.likes}</span>
            <span className="rounded-xl bg-white/[0.04] px-3 py-2">Comments · {p.counts.comments}</span>
            <span className="rounded-xl bg-white/[0.04] px-3 py-2">Reposts · {p.counts.reposts}</span>
            <span className="rounded-xl bg-white/[0.04] px-3 py-2">Shares · {p.shareCount}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
