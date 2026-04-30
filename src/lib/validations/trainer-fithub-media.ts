const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const FITHUB_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const FITHUB_VIDEO_MAX_BYTES = 80 * 1024 * 1024;

export function assertFitHubImageMime(mime: string): "jpg" | "png" | "webp" | "gif" {
  if (!IMAGE_MIMES.has(mime)) {
    throw new Error("Use JPEG, PNG, WebP, or GIF.");
  }
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "gif";
}

export function assertFitHubVideoMime(mime: string): "mp4" | "webm" | "mov" {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  throw new Error("Use MP4, WebM, or MOV.");
}

export function isImageMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime);
}

export function isVideoMime(mime: string): boolean {
  return VIDEO_MIMES.has(mime);
}
