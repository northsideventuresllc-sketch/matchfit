"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type StudioMode = "photo" | "video" | "checkin" | "carousel";

const MS_DAY = 24 * 60 * 60 * 1000;

async function uploadFitHubFile(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/trainer/fithub/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
  return data.url;
}

function ComposerFields(props: {
  captionLabel: string;
  caption: string;
  onCaption: (v: string) => void;
  hashtagInput: string;
  onHashtags: (v: string) => void;
  scheduleValue: string;
  onSchedule: (v: string) => void;
  showCaption: boolean;
}) {
  return (
    <div className="space-y-4">
      {props.showCaption ? (
        <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
          {props.captionLabel}
          <textarea
            value={props.caption}
            onChange={(e) => props.onCaption(e.target.value)}
            rows={3}
            placeholder="Headline for your post (hashtags in captions are picked up too)."
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
          />
        </label>
      ) : null}
      <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
        Hashtags (optional)
        <input
          value={props.hashtagInput}
          onChange={(e) => props.onHashtags(e.target.value)}
          placeholder="#legs #strength — or comma-separated"
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
        />
      </label>
      <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
        Schedule (optional, up to 365 days)
        <input
          type="datetime-local"
          value={props.scheduleValue}
          onChange={(e) => props.onSchedule(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
        />
        <p className="mt-1 text-[10px] text-white/35">Leave empty to publish to FitHub now.</p>
      </label>
    </div>
  );
}

export function TrainerPremiumStudioClient() {
  const router = useRouter();
  const [mode, setMode] = useState<StudioMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [caption, setCaption] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduleValue, setScheduleValue] = useState("");

  const [singleMediaUrl, setSingleMediaUrl] = useState<string | null>(null);
  const [carouselUrls, setCarouselUrls] = useState<string[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setCaption("");
    setBodyText("");
    setHashtagInput("");
    setScheduleValue("");
    setSingleMediaUrl(null);
    setCarouselUrls([]);
    setError(null);
    setOk(null);
  }, []);

  const close = useCallback(() => {
    setMode(null);
    resetForm();
  }, [resetForm]);

  const scheduleIso = useCallback((): string | null => {
    if (!scheduleValue.trim()) return null;
    const d = new Date(scheduleValue);
    if (Number.isNaN(d.getTime())) return null;
    const now = Date.now();
    if (d.getTime() <= now + 60_000) return null;
    if (d.getTime() > now + 365 * MS_DAY) {
      throw new Error("Schedule cannot be more than 365 days in advance.");
    }
    return d.toISOString();
  }, [scheduleValue]);

  const createPost = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      setOk(null);
      try {
        const res = await fetch("/api/trainer/fithub/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; scheduledPublishAt?: string | null };
        if (!res.ok) {
          setError(data.error ?? "Could not save post.");
          return;
        }
        setOk(data.scheduledPublishAt ? "Post scheduled for FitHub." : "Posted to FitHub.");
        router.refresh();
        window.setTimeout(() => close(), 900);
      } catch {
        setError("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [close, router],
  );

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || mode !== "photo") return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadFitHubFile(file);
      setSingleMediaUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const onPickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || mode !== "video") return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadFitHubFile(file);
      setSingleMediaUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const onPickCarousel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? [...e.target.files] : [];
    e.target.value = "";
    if (!files.length || mode !== "carousel") return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, 12)) {
        urls.push(await uploadFitHubFile(f));
      }
      setCarouselUrls((prev) => [...prev, ...urls].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  async function submitCheckIn() {
    try {
      const sched = scheduleIso();
      await createPost({
        postType: "TEXT",
        caption: caption.trim() || null,
        bodyText: bodyText.trim() || null,
        hashtagInput,
        scheduledPublishAt: sched,
        visibility: "PUBLIC",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid schedule.");
    }
  }

  async function submitPhoto() {
    if (!singleMediaUrl) {
      setError("Upload a photo first.");
      return;
    }
    try {
      const sched = scheduleIso();
      await createPost({
        postType: "IMAGE",
        caption: caption.trim() || null,
        bodyText: bodyText.trim() || null,
        mediaUrl: singleMediaUrl,
        hashtagInput,
        scheduledPublishAt: sched,
        visibility: "PUBLIC",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid schedule.");
    }
  }

  async function submitVideo() {
    if (!singleMediaUrl) {
      setError("Upload a video first.");
      return;
    }
    try {
      const sched = scheduleIso();
      await createPost({
        postType: "VIDEO",
        caption: caption.trim() || null,
        bodyText: bodyText.trim() || null,
        mediaUrl: singleMediaUrl,
        hashtagInput,
        scheduledPublishAt: sched,
        visibility: "PUBLIC",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid schedule.");
    }
  }

  async function submitCarousel() {
    if (carouselUrls.length < 2) {
      setError("Add at least two media files for a carousel.");
      return;
    }
    try {
      const sched = scheduleIso();
      await createPost({
        postType: "CAROUSEL",
        caption: caption.trim() || null,
        bodyText: bodyText.trim() || null,
        mediaUrls: carouselUrls,
        hashtagInput,
        scheduledPublishAt: sched,
        visibility: "PUBLIC",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid schedule.");
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode("photo");
          }}
          className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0E1016]/70 px-4 py-4 text-center transition hover:border-[#FF7E00]/35"
        >
          <span className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Photo Studio</span>
          <span className="mt-2 text-xs text-white/45">Upload an image, add a caption, post or schedule.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode("video");
          }}
          className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0E1016]/70 px-4 py-4 text-center transition hover:border-[#FF7E00]/35"
        >
          <span className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Video Clip</span>
          <span className="mt-2 text-xs text-white/45">Upload a clip, add a caption, post or schedule.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode("checkin");
          }}
          className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0E1016]/70 px-4 py-4 text-center transition hover:border-[#FF7E00]/35"
        >
          <span className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Check In Post</span>
          <span className="mt-2 text-xs text-white/45">Write a text update with optional hashtags.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode("carousel");
          }}
          className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0E1016]/70 px-4 py-4 text-center transition hover:border-[#FF7E00]/35"
        >
          <span className="text-sm font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">Media Carousel</span>
          <span className="mt-2 text-xs text-white/45">Swipe montage — upload multiple photos or videos.</span>
        </button>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickPhoto(e)} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => void onPickVideo(e)} />
      <input
        ref={carouselInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => void onPickCarousel(e)}
      />

      {mode ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#12151C] p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black uppercase tracking-wide text-white/95">
                {mode === "photo"
                  ? "Photo Studio"
                  : mode === "video"
                    ? "Video Clip"
                    : mode === "checkin"
                      ? "Check In Post"
                      : "Media Carousel"}
              </h2>
              <button type="button" onClick={close} className="text-xs font-bold uppercase text-white/50 hover:text-white">
                Close
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-sm text-[#FFB4B4]" role="alert">
                {error}
              </p>
            ) : null}
            {ok ? (
              <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
                {ok}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              {mode === "checkin" ? (
                <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
                  Post text
                  <textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={5}
                    placeholder="What do you want clients to know?"
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
                  />
                </label>
              ) : null}

              {mode === "photo" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-4 py-3 text-sm font-bold text-white transition hover:border-[#FF7E00]/55 disabled:opacity-50"
                  >
                    {singleMediaUrl ? "Replace photo" : "Upload photo"}
                  </button>
                  {singleMediaUrl ? (
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={singleMediaUrl} alt="" className="max-h-56 w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "video" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-4 py-3 text-sm font-bold text-white transition hover:border-[#FF7E00]/55 disabled:opacity-50"
                  >
                    {singleMediaUrl ? "Replace video" : "Upload video"}
                  </button>
                  {singleMediaUrl ? (
                    <video src={singleMediaUrl} className="max-h-56 w-full rounded-xl border border-white/10" controls playsInline />
                  ) : null}
                </div>
              ) : null}

              {mode === "carousel" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => carouselInputRef.current?.click()}
                    className="w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-4 py-3 text-sm font-bold text-white transition hover:border-[#FF7E00]/55 disabled:opacity-50"
                  >
                    Add media to carousel
                  </button>
                  {carouselUrls.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {carouselUrls.map((u, i) => (
                        <div key={`${u}-${i}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10">
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
                  <p className="text-[10px] text-white/35">{carouselUrls.length} file(s) — need at least 2.</p>
                </div>
              ) : null}

              <ComposerFields
                captionLabel={mode === "checkin" ? "Optional headline" : "Caption"}
                showCaption={mode === "checkin" || mode === "photo" || mode === "video" || mode === "carousel"}
                caption={caption}
                onCaption={setCaption}
                hashtagInput={hashtagInput}
                onHashtags={setHashtagInput}
                scheduleValue={scheduleValue}
                onSchedule={setScheduleValue}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy ||
                  (mode === "checkin" && !bodyText.trim() && !caption.trim()) ||
                  (mode === "photo" && !singleMediaUrl) ||
                  (mode === "video" && !singleMediaUrl) ||
                  (mode === "carousel" && carouselUrls.length < 2)
                }
                onClick={() => {
                  if (mode === "checkin") void submitCheckIn();
                  else if (mode === "photo") void submitPhoto();
                  else if (mode === "video") void submitVideo();
                  else void submitCarousel();
                }}
                className="flex-1 rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#0B0C0F] disabled:opacity-50"
              >
                {busy ? "Saving…" : scheduleValue.trim() ? "Schedule" : "Post to FitHub"}
              </button>
            </div>

            <p className="mt-4 text-center text-[10px] text-white/35">
              <Link
                href="/trainer/dashboard/premium/fit-hub-content#my-content"
                className="text-[#FF7E00] underline-offset-2 hover:underline"
              >
                MY CONTENT
              </Link>{" "}
              — view, share, delete, or make posts private.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
