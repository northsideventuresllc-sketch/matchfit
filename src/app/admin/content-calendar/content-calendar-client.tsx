"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import {
  AdminPortalAlert,
  AdminPortalBackdrop,
  AdminPortalBetaNotice,
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
  CONTENT_CALENDAR_CONTENT_TYPES,
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_DAYS_SHORT,
  CONTENT_CALENDAR_PLATFORMS_GEN,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TONES,
  CONTENT_CALENDAR_TYPE_ICONS,
} from "@/lib/content-calendar/constants";
import {
  formatCalendarDate,
  getContentCalendarRotation,
  getMondayOfWeek,
  shortCalendarDate,
} from "@/lib/content-calendar/rotation";
import { shouldShowMissedPrompt } from "@/lib/content-calendar/schedule-utils";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type GeneratorResult = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  dmScript?: string;
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={adminSecondaryButtonClass}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function MissedPostBubble(props: {
  post: ClientContentPost;
  onReschedule: (id: string, newDate: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [newDate, setNewDate] = useState(props.post.postDate);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-[#FF7E00]/35 bg-[#12151C]/95 p-4 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF7E00]">Missed post</p>
      <p className="mt-2 text-sm text-white/75">
        {props.post.postType} for {CONTENT_CALENDAR_DAYS_LONG[props.post.dayIndex]} was not marked posted. Change the
        post date?
      </p>
      {!showPicker ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={adminAccentButtonClass}
            onClick={() => setShowPicker(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void props.onDismiss(props.post.id).finally(() => setBusy(false));
            }}
          >
            No
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className={adminLabelClass}>New post date</label>
          <input type="date" className={adminInputClassSm} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button
            type="button"
            className={`${adminPrimaryButtonClass} min-h-0 py-2.5 text-xs`}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void props.onReschedule(props.post.id, newDate).finally(() => setBusy(false));
            }}
          >
            Save new date
          </button>
        </div>
      )}
    </div>
  );
}

export function ContentCalendarClient(props: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<"calendar" | "generator">("calendar");
  const [weekStart, setWeekStart] = useState(() => formatCalendarDate(getMondayOfWeek()));
  const [offset, setOffset] = useState(7);
  const [posts, setPosts] = useState<ClientContentPost[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialSummary, setSocialSummary] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [missedPosts, setMissedPosts] = useState<ClientContentPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { caption: string; visualPrompt: string | null }>>({});

  const baseMonday = useMemo(() => new Date(`${weekStart}T00:00:00`), [weekStart]);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-calendar/schedule?weekStart=${weekStart}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load schedule.");
      setPosts(data.posts ?? []);
      const nextDrafts: Record<string, { caption: string; visualPrompt: string | null }> = {};
      for (const p of data.posts ?? []) {
        nextDrafts[p.id] = { caption: p.caption, visualPrompt: p.visualPrompt };
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const loadMissed = useCallback(async () => {
    const res = await fetch("/api/admin/content-calendar/missed", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { posts?: ClientContentPost[] };
    setMissedPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSchedule();
      void loadMissed();
    });
  }, [loadSchedule, loadMissed]);

  async function generateWeek() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, offset }),
      });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setPosts(data.posts ?? []);
      const nextDrafts: Record<string, { caption: string; visualPrompt: string | null }> = {};
      for (const p of data.posts ?? []) {
        nextDrafts[p.id] = { caption: p.caption, visualPrompt: p.visualPrompt };
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function savePost(post: ClientContentPost) {
    const draft = drafts[post.id];
    if (!draft) return;
    const res = await fetch(`/api/admin/content-calendar/posts/${post.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: draft.caption,
        visualPrompt: draft.visualPrompt,
        originalCaption: post.caption,
        originalVisualPrompt: post.visualPrompt,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save edits.");
    }
  }

  async function markPosted(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "posted" }),
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      void loadMissed();
    }
  }

  async function generateMedia(post: ClientContentPost) {
    const prompt = drafts[post.id]?.visualPrompt ?? post.visualPrompt;
    if (!prompt) return;
    setError(null);
    const res = await fetch(`/api/admin/content-calendar/posts/${post.id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_media", prompt }),
    });
    const data = (await res.json()) as { mediaUrl?: string; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Media generation failed.");
      return;
    }
    if (data.mediaUrl) {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, mediaUrl: data.mediaUrl!, mediaStatus: "ready" } : p)),
      );
    }
  }

  async function runSocialScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/social-scan", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Scan failed.");
      setSocialSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  function exportWeek() {
    let out = "MATCH FIT — WEEKLY CONTENT EXPORT\n";
    out += `Week of ${baseMonday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\n`;
    out += "=".repeat(50) + "\n\n";
    CONTENT_CALENDAR_DAYS_SHORT.forEach((_, di) => {
      out += `${CONTENT_CALENDAR_DAYS_LONG[di].toUpperCase()} — ${shortCalendarDate(baseMonday, di)}\n${"─".repeat(30)}\n\n`;
      const dayPosts = posts.filter((p) => p.dayIndex === di);
      for (const p of dayPosts) {
        const cap = drafts[p.id]?.caption ?? p.caption;
        const prompt = drafts[p.id]?.visualPrompt ?? p.visualPrompt;
        out += `[${p.postType.toUpperCase()} · ${p.platforms} · ${p.targetGroup}]\n${cap}\n`;
        if (prompt) out += `\nVisual prompt:\n${prompt}\n`;
        if (p.hashtags.length) out += `\n${p.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`;
        out += "\n\n";
      }
    });
    void navigator.clipboard.writeText(out);
  }

  const visibleDayIndexes =
    activeDay === null ? [0, 1, 2, 3, 4] : [activeDay];

  const bubblePost = missedPosts[0];

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="space-y-4">
          <AdminPortalNav current="content-calendar" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Match Fit</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Content Calendar</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Generate M–F Facebook and Threads posts with video, carousel, and static prompts. Learns from your edits
                via{" "}
                <Link href="https://supabase.com/dashboard/project/kxijunwgbrlfzvgkhklo" className={adminLinkClass}>
                  NI Brain
                </Link>
                .{" "}
                <Link href="/admin" className={adminLinkClass}>
                  Back to dashboard
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={adminSecondaryButtonClass} disabled={scanning} onClick={() => void runSocialScan()}>
                {scanning ? "Scanning…" : "Scan social"}
              </button>
            </div>
          </div>
        </header>

        <AdminPortalBetaNotice />

        {!props.aiStatus.niBrain ? (
          <AdminPortalAlert variant="info">
            NI Brain Supabase keys are not set. Add NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY to
            Vercel production env or store them in platform_secrets (via bootstrap script), then redeploy.
          </AdminPortalAlert>
        ) : null}

        {!props.aiStatus.configured ? (
          <AdminPortalAlert variant="info">{props.aiStatus.message}</AdminPortalAlert>
        ) : null}

        {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}

        {socialSummary ? (
          <section className={`${adminPanelClass} p-5`}>
            <p className={adminLabelClass}>Social performance insights</p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{socialSummary}</pre>
          </section>
        ) : null}

        <div className="flex gap-2 border-b border-white/[0.06] pb-1">
          {(["calendar", "generator"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={
                tab === t
                  ? "border-b-2 border-[#FF7E00] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                  : "px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/40 hover:text-white/70"
              }
              onClick={() => setTab(t)}
            >
              {t === "calendar" ? "Weekly calendar" : "AI generator"}
            </button>
          ))}
        </div>

        {tab === "calendar" ? (
          <div className="space-y-6">
            <section className={`${adminPanelClass} flex flex-wrap items-end gap-4 p-5`}>
              <div>
                <label className={adminLabelClass}>Week start</label>
                <input
                  type="date"
                  className={`${adminInputClassSm} mt-1`}
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </div>
              <div>
                <label className={adminLabelClass}>Day offset</label>
                <input
                  type="number"
                  min={0}
                  className={`${adminInputClassSm} mt-1 w-20`}
                  value={offset}
                  onChange={(e) => setOffset(Number.parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <button
                type="button"
                className={`${adminPrimaryButtonClass} min-h-0 px-5 py-2.5 text-xs`}
                disabled={generating || !props.aiStatus.configured}
                onClick={() => void generateWeek()}
              >
                {generating ? "Generating week…" : "Generate week"}
              </button>
              <button type="button" className={adminSecondaryButtonClass} onClick={exportWeek} disabled={!posts.length}>
                Export week
              </button>
              <p className="ml-auto max-w-xs text-[10px] leading-relaxed text-white/35">
                Baseline rotation: Carousel→Atlanta Trainers · Static→Virtual Trainers · Video→Atlanta Clients ·
                Text→Virtual Clients
              </p>
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={activeDay === null ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setActiveDay(null)}
              >
                All days
              </button>
              {CONTENT_CALENDAR_DAYS_SHORT.map((_, di) => (
                <button
                  key={di}
                  type="button"
                  className={activeDay === di ? adminAccentButtonClass : adminSecondaryButtonClass}
                  onClick={() => setActiveDay(activeDay === di ? null : di)}
                >
                  {CONTENT_CALENDAR_DAYS_SHORT[di]}{" "}
                  <span className="opacity-50">{shortCalendarDate(baseMonday, di)}</span>
                </button>
              ))}
            </div>

            {loading ? <p className="text-sm text-white/50">Loading schedule…</p> : null}

            {!loading && posts.length === 0 ? (
              <p className={`${adminPanelClass} p-6 text-sm text-white/55`}>
                No posts scheduled for this week. Click <strong className="text-[#FFD34E]">Generate week</strong> to
                create 20 M–F posts (4 types × 5 days) with captions, hashtags, and visual prompts.
              </p>
            ) : null}

            {visibleDayIndexes.map((di) => {
              const rot = getContentCalendarRotation(di, offset);
              const dayPosts = posts.filter((p) => p.dayIndex === di);
              if (!dayPosts.length) return null;
              return (
                <section key={di} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-[#FF7E00]">{CONTENT_CALENDAR_DAYS_LONG[di]}</h2>
                    <span className="text-xs text-white/35">{shortCalendarDate(baseMonday, di)}</span>
                    <div className="h-px flex-1 bg-[#FF7E00]/15" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {CONTENT_CALENDAR_POST_TYPES.map((type) => {
                      const post = dayPosts.find((p) => p.postType === type);
                      if (!post) return null;
                      const draft = drafts[post.id] ?? { caption: post.caption, visualPrompt: post.visualPrompt };
                      const promKey = post.id;
                      const isPromptOpen = expandedPrompt === promKey;
                      const overdue = shouldShowMissedPrompt({
                        postDate: post.postDate,
                        posted: post.posted,
                        missedPromptDismissed: post.missedPromptDismissed,
                      });
                      return (
                        <article key={post.id} className={`${adminPanelClass} p-4 ${overdue ? "ring-1 ring-amber-400/40" : ""}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E]">
                              {CONTENT_CALENDAR_TYPE_ICONS[type]} {type}
                            </span>
                            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/45">
                              {rot[type]}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] uppercase tracking-wide text-white/35">{post.platforms}</p>
                          {post.hashtags.length ? (
                            <p className="mt-1 text-[11px] text-white/40">
                              {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                            </p>
                          ) : null}
                          <textarea
                            className={`${adminInputClassSm} mt-3`}
                            rows={5}
                            value={draft.caption}
                            onChange={(e) =>
                              setDrafts((p) => ({ ...p, [post.id]: { ...draft, caption: e.target.value } }))
                            }
                            onBlur={() => void savePost(post)}
                          />
                          {draft.visualPrompt !== null ? (
                            <>
                              <button
                                type="button"
                                className={`${adminSecondaryButtonClass} mt-2`}
                                onClick={() => setExpandedPrompt(isPromptOpen ? null : promKey)}
                              >
                                {isPromptOpen ? "Hide prompt" : "Visual prompt"}
                              </button>
                              {isPromptOpen ? (
                                <textarea
                                  className={`${adminInputClassSm} mt-2 border-dashed border-[#FF7E00]/25`}
                                  rows={4}
                                  value={draft.visualPrompt ?? ""}
                                  onChange={(e) =>
                                    setDrafts((p) => ({
                                      ...p,
                                      [post.id]: { ...draft, visualPrompt: e.target.value },
                                    }))
                                  }
                                  onBlur={() => void savePost(post)}
                                />
                              ) : null}
                            </>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <CopyButton text={draft.caption} label="Copy caption" />
                            {draft.visualPrompt ? <CopyButton text={draft.visualPrompt} label="Copy prompt" /> : null}
                            {(type === "Static" || type === "Carousel") && props.aiStatus.media ? (
                              <button
                                type="button"
                                className={adminAccentButtonClass}
                                onClick={() => void generateMedia(post)}
                              >
                                Generate image
                              </button>
                            ) : null}
                            {post.mediaUrl ? (
                              <a
                                href={post.mediaUrl}
                                download={`match-fit-${post.postType.toLowerCase()}-${post.postDate}.png`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={adminSecondaryButtonClass}
                              >
                                Download media
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className={`${adminAccentButtonClass} ml-auto`}
                              onClick={() => void markPosted(post.id)}
                            >
                              Mark posted
                            </button>
                          </div>
                          {post.mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.mediaUrl} alt="" className="mt-3 max-h-48 rounded-xl border border-white/10" />
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <GeneratorPanel configured={props.aiStatus.configured} />
        )}
      </div>

      {bubblePost ? (
        <MissedPostBubble
          post={bubblePost}
          onDismiss={async (id) => {
            await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "dismiss_missed" }),
            });
            void loadMissed();
          }}
          onReschedule={async (id, newDate) => {
            await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reschedule", newDate }),
            });
            void loadSchedule();
            void loadMissed();
          }}
        />
      ) : null}
    </main>
  );
}

function GeneratorPanel(props: { configured: boolean }) {
  const [platform, setPlatform] = useState("Instagram");
  const [contentType, setContentType] = useState("Trainer Recruitment");
  const [tone, setTone] = useState("Bold / Direct");
  const [customNote, setCustomNote] = useState("");
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/content-calendar/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, contentType, tone, customNote }),
      });
      const data = (await res.json()) as { result?: GeneratorResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setResult(data.result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  const fullPost = result
    ? `${result.hook}\n\n${result.body}\n\n${result.cta}\n\n${result.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className={`${adminPanelClass} space-y-5 p-5`}>
        <div>
          <p className={adminLabelClass}>Platform</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_CALENDAR_PLATFORMS_GEN.map((p) => (
              <button
                key={p}
                type="button"
                className={platform === p ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setPlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={adminLabelClass}>Content type</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {CONTENT_CALENDAR_CONTENT_TYPES.map((c) => (
              <button
                key={c}
                type="button"
                className={`${c === contentType ? adminAccentButtonClass : adminSecondaryButtonClass} text-left`}
                onClick={() => setContentType(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={adminLabelClass}>Tone</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_CALENDAR_TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={tone === t ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={adminLabelClass}>Custom notes</p>
          <textarea className={`${adminInputClassSm} mt-2`} rows={3} value={customNote} onChange={(e) => setCustomNote(e.target.value)} />
        </div>
        <button
          type="button"
          className={`${adminPrimaryButtonClass} min-h-0 py-2.5 text-xs`}
          disabled={loading || !props.configured}
          onClick={() => void generate()}
        >
          {loading ? "Generating…" : "Generate post"}
        </button>
        {error ? <p className="text-xs text-[#FFB4B4]">{error}</p> : null}
      </aside>

      <section className={`${adminPanelClass} min-h-[320px] p-6`}>
        {!result && !loading ? (
          <p className="text-sm text-white/40">Select options and generate a single post with hook, body, CTA, and hashtags.</p>
        ) : null}
        {loading ? <p className="text-sm text-white/50">Crafting your post…</p> : null}
        {result ? (
          <div className="space-y-4">
            <div className="flex justify-between gap-3">
              <p className={adminLabelClass}>Full post</p>
              <CopyButton text={fullPost} label="Copy full post" />
            </div>
            <div className="text-sm leading-relaxed text-white/75">
              <p className="font-semibold text-[#FF7E00]">{result.hook}</p>
              <p className="mt-3">{result.body}</p>
              <p className="mt-3 font-medium text-[#FFD34E]">{result.cta}</p>
              <p className="mt-3 text-xs text-white/40">
                {result.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
              </p>
            </div>
            {result.dmScript ? (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm italic text-white/55">
                {result.dmScript}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
