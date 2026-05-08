/** Trainer → client chat file share: category chosen in UI, validated on upload. */
export type ChatAttachmentFileKind = "IMAGE" | "VIDEO" | "DOCUMENT" | "OTHER";

const MB = 1024 * 1024;

/** Max size per upload, per category (single-request limit). */
export const CHAT_ATTACHMENT_MAX_BY_KIND: Record<ChatAttachmentFileKind, number> = {
  /** Photos / graphics — typical messaging cap. */
  IMAGE: 20 * MB,
  /** Short clips — larger cap; encourage compression for very long recordings. */
  VIDEO: 100 * MB,
  /** PDF & Office — standard email-style limits. */
  DOCUMENT: 25 * MB,
  /** Plain text, CSV, small JSON/Markdown — not for large binaries. */
  OTHER: 5 * MB,
};

const IMAGE_MIMES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const VIDEO_MIMES = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

const DOCUMENT_MIMES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/rtf", "rtf"],
  ["text/rtf", "rtf"],
]);

const OTHER_MIMES = new Map<string, string>([
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["application/json", "json"],
  ["text/markdown", "md"],
]);

function mimeMapForKind(kind: ChatAttachmentFileKind): Map<string, string> {
  switch (kind) {
    case "IMAGE":
      return IMAGE_MIMES;
    case "VIDEO":
      return VIDEO_MIMES;
    case "DOCUMENT":
      return DOCUMENT_MIMES;
    case "OTHER":
      return OTHER_MIMES;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** HTML `accept` for `<input type="file">` per category. */
export function chatAttachmentInputAcceptForKind(kind: ChatAttachmentFileKind): string {
  return [...mimeMapForKind(kind).keys()].join(",");
}

export function formatChatAttachmentMegabytes(bytes: number): string {
  const mb = bytes / MB;
  if (mb >= 10) return `${Math.round(mb)}`;
  if (mb >= 1) return mb.toFixed(0);
  return mb.toFixed(1);
}

export const CHAT_ATTACHMENT_KIND_MENU: readonly {
  kind: ChatAttachmentFileKind;
  title: string;
  typesShort: string;
}[] = [
  {
    kind: "IMAGE",
    title: "Image",
    typesShort: "JPEG, PNG, GIF, WebP, HEIC",
  },
  {
    kind: "VIDEO",
    title: "Video",
    typesShort: "MP4, WebM, QuickTime (.mov)",
  },
  {
    kind: "DOCUMENT",
    title: "Document",
    typesShort: "PDF, Word, Excel, PowerPoint, RTF",
  },
  {
    kind: "OTHER",
    title: "Other",
    typesShort: "Plain text, CSV, JSON, Markdown",
  },
];

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

export function parseChatAttachmentFileKind(raw: unknown): ChatAttachmentFileKind | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (u === "IMAGE" || u === "VIDEO" || u === "DOCUMENT" || u === "OTHER") return u;
  return null;
}

export function assertChatAttachmentForKind(
  file: { type: string; size: number },
  kind: ChatAttachmentFileKind,
): { ext: string; mimeType: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Choose a valid file.");
  }
  const max = CHAT_ATTACHMENT_MAX_BY_KIND[kind];
  if (file.size > max) {
    const label = CHAT_ATTACHMENT_KIND_MENU.find((r) => r.kind === kind)?.title ?? kind;
    throw new Error(
      `This file is too large for “${label}” (max ${formatChatAttachmentMegabytes(max)} MB per upload).`,
    );
  }
  const map = mimeMapForKind(kind);
  const ext = map.get(file.type);
  if (!ext) {
    const label = CHAT_ATTACHMENT_KIND_MENU.find((r) => r.kind === kind)?.title ?? kind;
    throw new Error(
      `That file type is not allowed for “${label}”. Choose the right category or use one of the listed types.`,
    );
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
