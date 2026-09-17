"use client";

import { useCallback, useRef, useState } from "react";
import { adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";

/**
 * Direct file uploader for Content Calendar assets.
 * Uses presigned Supabase Storage URLs with XHR upload to bypass Vercel's 4.5MB serverless limits,
 * supporting large videos and carousels of arbitrary size with live percentage progress.
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
  const [progressPercent, setProgressPercent] = useState<number | null>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setBusy(true);
      setProgressPercent(0);
      try {
        const urls: string[] = [];
        const fileList = Array.from(files);

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];

          // 1. Request presigned upload URL from NI Brain Supabase Storage
          const signRes = await fetch("/api/admin/content-calendar/v2/media-upload/sign", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              jobId: postId,
              label,
              contentType: file.type || "application/octet-stream",
            }),
          });

          if (!signRes.ok) {
            const errData = (await signRes.json().catch(() => ({}))) as { error?: string };
            // If under 4MB, attempt fallback multipart route before throwing
            if (file.size < 4 * 1024 * 1024) {
              const form = new FormData();
              form.append("file", file);
              form.append("jobId", postId);
              form.append("label", label);
              const fallbackRes = await fetch("/api/admin/content-calendar/v2/media-upload", {
                method: "POST",
                credentials: "include",
                body: form,
              });
              const fallbackData = (await fallbackRes.json().catch(() => ({}))) as { url?: string; error?: string };
              if (fallbackRes.ok && fallbackData.url) {
                urls.push(fallbackData.url);
                continue;
              }
            }
            throw new Error(errData.error ?? `Upload authorization failed (${signRes.status}).`);
          }

          const signData = (await signRes.json()) as { signedUrl?: string; publicUrl?: string };
          if (!signData.signedUrl || !signData.publicUrl) {
            throw new Error("Invalid presigned upload response from server.");
          }

          // 2. Direct binary PUT upload with progress tracking
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", signData.signedUrl, true);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100);
                setProgressPercent(percent);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(
                  new Error(
                    `Supabase Storage upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText || "Unknown error"}`,
                  ),
                );
              }
            };

            xhr.onerror = () => {
              reject(new Error("Network connection error during file upload to storage."));
            };

            xhr.send(file);
          });

          urls.push(signData.publicUrl);
        }

        onUploaded(urls);
      } catch (e) {
        console.error("[DeviceMediaUploadWidget]", e);
        onError?.(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
        setProgressPercent(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [postId, label, onUploaded, onError],
  );

  const displayButtonText =
    progressPercent !== null && progressPercent > 0 && progressPercent < 100
      ? `UPLOADING ${progressPercent}%…`
      : busy
        ? "UPLOADING…"
        : buttonLabel;

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
        {displayButtonText}
      </button>
    </>
  );
}
