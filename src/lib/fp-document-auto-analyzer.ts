import type { FpDocType } from "@/lib/fp-account-tier-types";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";

export type FpDocAutoDecision = "approve" | "deny" | "review";

export type FpDocAutoAnalysisResult = {
  decision: FpDocAutoDecision;
  summary: string;
};

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const DOC_EXTS = new Set(["pdf", ...IMAGE_EXTS]);

function extFromUrl(fileUrl: string): string | null {
  const clean = fileUrl.split("?")[0] ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match?.[1]?.toLowerCase() ?? null;
}

function mimeFromExt(ext: string | null): string | null {
  if (!ext) return null;
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

function expectedFormats(docType: FpDocType): { exts: Set<string>; imagesOnly: boolean } {
  switch (docType) {
    case "headshot":
    case "business_logo":
      return { exts: IMAGE_EXTS, imagesOnly: true };
    case "professional_certification":
    case "liability_insurance":
    case "business_registration":
      return { exts: DOC_EXTS, imagesOnly: false };
    case "facility_proof":
      return { exts: DOC_EXTS, imagesOnly: false };
    default:
      return { exts: DOC_EXTS, imagesOnly: false };
  }
}

/**
 * Initial automated reading for FP onboarding documents.
 * Uses file metadata heuristics; human review is still required before final status.
 */
export function analyzeFpDocumentUpload(input: {
  docType: FpDocType;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
}): FpDocAutoAnalysisResult {
  const label = FP_DOC_TYPE_LABELS[input.docType];
  const ext = extFromUrl(input.fileUrl);
  const { exts, imagesOnly } = expectedFormats(input.docType);

  if (!ext || !exts.has(ext)) {
    const formatHint = imagesOnly ? "JPG, PNG, or WebP image" : "PDF or image (JPG, PNG, WebP)";
    return {
      decision: "deny",
      summary: `${label} must be uploaded as a ${formatHint}. Please re-upload a clear file in the correct format.`,
    };
  }

  const expectedMime = mimeFromExt(ext);
  if (expectedMime && input.mimeType && input.mimeType !== expectedMime && input.mimeType !== "application/octet-stream") {
    return {
      decision: "review",
      summary: `The file type for ${label} looks unusual (${input.mimeType}). A staff member will verify it manually.`,
    };
  }

  if (input.fileSizeBytes < 4_096) {
    return {
      decision: "deny",
      summary: `${label} file is too small or empty. Upload a full, readable copy.`,
    };
  }

  if (input.fileSizeBytes > 5 * 1024 * 1024) {
    return {
      decision: "deny",
      summary: `${label} exceeds the 5 MB upload limit. Compress the file and try again.`,
    };
  }

  if (imagesOnly && ext === "pdf") {
    return {
      decision: "deny",
      summary: `${label} should be an image file, not a PDF.`,
    };
  }

  if (input.docType === "headshot" && input.fileSizeBytes < 12_000) {
    return {
      decision: "review",
      summary: "Headshot uploaded, but the file is very small. Staff will confirm it is a clear, professional photo.",
    };
  }

  if (input.docType === "business_logo" && input.fileSizeBytes < 8_000) {
    return {
      decision: "review",
      summary: "Logo uploaded, but resolution may be low. Staff will confirm it displays clearly.",
    };
  }

  return {
    decision: "approve",
    summary: `${label} passed initial automated checks and is queued for staff confirmation.`,
  };
}
