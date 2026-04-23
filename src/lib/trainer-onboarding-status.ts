const BG = new Set(["NOT_STARTED", "PENDING", "APPROVED", "NEEDS_FURTHER_REVIEW", "DENIED"]);
const CPT = new Set(["NOT_STARTED", "PENDING", "APPROVED", "DENIED"]);

export type TrainerBackgroundVendorStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "NEEDS_FURTHER_REVIEW"
  | "DENIED";

export type TrainerCptStatus = "NOT_STARTED" | "PENDING" | "APPROVED" | "DENIED";

export function coerceTrainerBackgroundVendorStatus(raw: string | null | undefined): TrainerBackgroundVendorStatus {
  const trimmed = (raw ?? "").trim();
  /// Legacy default column used lowercase `pending` for “not started”; new pipeline uses uppercase `PENDING`.
  if (trimmed === "pending") return "NOT_STARTED";
  if (trimmed === "approved") return "APPROVED";
  const v = trimmed.toUpperCase().replace(/-/g, "_");
  if (BG.has(v)) return v as TrainerBackgroundVendorStatus;
  return "NOT_STARTED";
}

export function coerceTrainerCptStatus(raw: string | null | undefined): TrainerCptStatus {
  const v = (raw ?? "NOT_STARTED").trim().toUpperCase();
  if (CPT.has(v)) return v as TrainerCptStatus;
  if (raw === "none") return "NOT_STARTED";
  if (raw === "pending_human_review") return "PENDING";
  if (raw === "approved") return "APPROVED";
  return "NOT_STARTED";
}
