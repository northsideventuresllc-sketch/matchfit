"use client";

import { useCallback, useRef, useState } from "react";
import { adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";

/**
 * Hidden file input wrapped in a button. Posts each selected file straight to the v2 media-upload
 * route (now admin-session-capable, not just Cowork) and hands the resulting public URL(s) back
 * via onUploaded. Shared by two flows that both just need "here are the URLs, nothing about where
 * the button lives": the Manually-Generate-Media day bypass (Lane 1) and Manually-Redo Media on a
 * single post (Lane 3).
 */
export function DeviceMediaUploadWidget({
  postId,
  label = "manual-upload",
  multiple = false,
  accept = "image/*,video/*",
  buttonLabel = "UPLOAD FROM DEVICE",
  disabled,
  onUploaded,
  onError,
}: {
  /** Used as the storage path's folder key — a post id for Lane 3, a post date for Lane 1. */
  postId: string;
  label?: string;
  multiple?: boolean;
  accept?: string;
  buttonLabel?: string;
  disabled?: boolean;
  onUploaded: (urls: string[]) => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setBusy(true);
      try {
        const urls: string[] = [];
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("file", file);
          form.append("jobId", postId);
          form.append("label", label);
          const res = await fetch("/api/admin/content-calendar/v2/media-upload", {
            method: "POST",
            credentials: "include",
            body: form,
          });
          const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
          urls.push(data.url);
        }
        onUploaded(urls);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [postId, label, onUploaded, onError],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) void handleFiles(files);
        }}
      />
      <button
        type="button"
        className={adminSecondaryButtonClass}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "UPLOADING…" : buttonLabel}
      </button>
    </>
  );
}
