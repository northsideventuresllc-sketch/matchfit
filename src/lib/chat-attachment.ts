export const CHAT_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

const MIME_TO_EXT = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

export type ChatAttachmentPayload = {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** When true, the message `body` is synthetic (compliance/logs only); hide it in bubbles. */
  syntheticBody?: boolean;
};

export function sanitizeChatAttachmentFilename(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
    .trim()
    .slice(0, 200);
  return base || "attachment";
}

export function assertChatAttachmentMime(file: { type: string; size: number }): { ext: string; mimeType: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Choose a valid file.");
  }
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error("File is too large (max 50 MB).");
  }
  const ext = MIME_TO_EXT.get(file.type);
  if (!ext) {
    throw new Error("This file type is not allowed for chat attachments.");
  }
  return { ext, mimeType: file.type };
}

export function parseChatAttachmentJson(raw: string | null | undefined): ChatAttachmentPayload | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const url = o.url;
    const filename = o.filename;
    const mimeType = o.mimeType;
    const sizeBytes = o.sizeBytes;
    const syntheticBody = o.syntheticBody;

    if (typeof url !== "string" || !url.startsWith("/uploads/chat-attachments/")) return null;
    if (typeof filename !== "string" || filename.length === 0 || filename.length > 300) return null;
    if (typeof mimeType !== "string" || mimeType.length > 180) return null;
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 0) return null;
    const payload: ChatAttachmentPayload = {
      url,
      filename: filename.slice(0, 300),
      mimeType,
      sizeBytes,
    };
    if (typeof syntheticBody === "boolean") payload.syntheticBody = syntheticBody;
    return payload;
  } catch {
    return null;
  }
}

export function serializeChatAttachmentPayload(payload: ChatAttachmentPayload): string {
  return JSON.stringify(payload);
}
