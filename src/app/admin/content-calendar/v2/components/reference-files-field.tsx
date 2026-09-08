"use client";

import { useState } from "react";
import { adminLabelClass } from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { DeviceMediaUploadWidget } from "./device-media-upload-widget";

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0];
    return decodeURIComponent(clean.split("/").pop() || url);
  } catch {
    return url;
  }
}

/**
 * Lets the operator attach reference photos, videos, or other files (a brand asset, a client
 * photo, a past post to match the look of) to a post before its media gets built. The Mac mini's
 * Gemini automation (gemini-media-automation.mjs) picks these up automatically and attaches them
 * into the generation chat before typing the prompt — see attachReferenceFiles in that script.
 */
export function ReferenceFilesField({
  post,
  onPatch,
  disabled,
}: {
  post: ClientContentCalendarV2Post;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const files = post.referenceFileUrls;

  const addFiles = async (urls: string[]) => {
    setBusy(true);
    setError(null);
    try {
      await onPatch(post.id, { referenceFileUrls: [...files, ...urls] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the reference file.");
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (url: string) => {
    setBusy(true);
    setError(null);
    try {
      await onPatch(post.id, { referenceFileUrls: files.filter((u) => u !== url) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the reference file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <span className={adminLabelClass}>Reference files (optional)</span>
      <p className="mt-1 text-[11px] text-white/45">
        Photos, videos, or other files for Gemini to look at while generating this post&apos;s media.
      </p>
      {files.length ? (
        <ul className="mt-2 space-y-1">
          {files.map((url) => (
            <li
              key={url}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs text-white/70"
            >
              <a href={url} target="_blank" rel="noreferrer" className="truncate hover:text-white">
                {fileNameFromUrl(url)}
              </a>
              <button
                type="button"
                className="shrink-0 text-white/40 hover:text-[#FFB4B4]"
                disabled={disabled || busy}
                onClick={() => void removeFile(url)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2">
        <DeviceMediaUploadWidget
          postId={post.id}
          label="reference"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          buttonLabel="ADD REFERENCE FILE"
          disabled={disabled || busy}
          onUploaded={(urls) => void addFiles(urls)}
          onError={(m) => setError(m)}
        />
      </div>
      {error ? <p className="mt-1.5 text-[11px] font-semibold text-[#FFB4B4]">{error}</p> : null}
    </div>
  );
}
