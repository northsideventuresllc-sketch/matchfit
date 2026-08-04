/**
 * Works out the real type of an uploaded document.
 *
 * Browsers are unreliable about `File.type`: depending on the OS and how the file was picked,
 * a perfectly good PDF can arrive as `""`, `application/octet-stream` or `application/x-pdf`.
 * The upload routes used to compare `file.type` against an exact-match map, so those uploads
 * were rejected with "Use PDF, JPG, PNG, or WebP." We now fall back to the file extension and
 * then to the file's own magic bytes, which is the only source the browser cannot get wrong.
 */

export type UploadFileKind = { ext: "pdf" | "jpg" | "png" | "webp"; mime: string };

const CANONICAL_MIME: Record<string, UploadFileKind> = {
  "application/pdf": { ext: "pdf", mime: "application/pdf" },
  "application/x-pdf": { ext: "pdf", mime: "application/pdf" },
  "image/jpeg": { ext: "jpg", mime: "image/jpeg" },
  "image/jpg": { ext: "jpg", mime: "image/jpeg" },
  "image/png": { ext: "png", mime: "image/png" },
  "image/webp": { ext: "webp", mime: "image/webp" },
};

const EXTENSION: Record<string, UploadFileKind> = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  jpg: { ext: "jpg", mime: "image/jpeg" },
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
  webp: { ext: "webp", mime: "image/webp" },
};

function fromMime(rawMime: string | null | undefined): UploadFileKind | null {
  const mime = rawMime?.trim().toLowerCase().split(";")[0] ?? "";
  return CANONICAL_MIME[mime] ?? null;
}

function fromFilename(name: string | null | undefined): UploadFileKind | null {
  const ext = name?.trim().toLowerCase().split(".").pop() ?? "";
  return EXTENSION[ext] ?? null;
}

/** Identifies the format from the leading bytes — the only check the browser cannot get wrong. */
function fromMagicBytes(bytes: Buffer): UploadFileKind | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { ext: "pdf", mime: "application/pdf" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/**
 * Resolves an upload to a supported document type, or null if it genuinely is not one.
 *
 * Magic bytes win: a file whose contents are a PDF is treated as a PDF even if the browser
 * labelled it something else, and a file merely *named* `.pdf` is rejected when its contents
 * are something else entirely.
 */
export function resolveUploadFileKind(args: {
  declaredMime: string | null | undefined;
  filename: string | null | undefined;
  bytes: Buffer;
}): UploadFileKind | null {
  return (
    fromMagicBytes(args.bytes) ?? fromMime(args.declaredMime) ?? fromFilename(args.filename) ?? null
  );
}

/** Shown when nothing recognises the upload. Kept in one place so both routes agree. */
export const UPLOAD_UNSUPPORTED_TYPE_MESSAGE = "Use a PDF, JPG, PNG, or WebP file.";
