"use client";

import type { ChatAttachmentPayload } from "@/lib/chat-attachment";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}

export function ChatAttachmentDisplay(props: {
  attachment: ChatAttachmentPayload;
  variant?: "trainer" | "client";
}) {
  const { attachment: a } = props;
  const tint = props.variant === "trainer" ? "border-white/[0.12] bg-black/20" : "border-white/[0.08] bg-black/15";
  const linkClass =
    props.variant === "trainer"
      ? "text-white/90 underline-offset-2 hover:underline"
      : "text-sky-100/95 underline-offset-2 hover:underline";

  return (
    <div className={`mt-2 overflow-hidden rounded-xl border px-3 py-2.5 ${tint}`}>
      <div className="flex min-w-0 flex-col gap-2">
        {isImage(a.mimeType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.url}
            alt=""
            className="max-h-52 max-w-full rounded-lg object-contain"
            loading="lazy"
          />
        ) : null}
        {isVideo(a.mimeType) ? (
          <video src={a.url} controls className="max-h-52 w-full rounded-lg bg-black/40" preload="metadata" />
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white/90">{a.filename}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/40">
              {a.mimeType} · {formatBytes(a.sizeBytes)}
            </p>
          </div>
          <a
            href={a.url}
            download={a.filename}
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] ${linkClass}`}
          >
            Open / save
          </a>
        </div>
      </div>
    </div>
  );
}
