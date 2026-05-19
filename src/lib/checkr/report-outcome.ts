import type { CheckrReport } from "@/lib/checkr/client";

export type BackgroundCheckVendorOutcome = "CLEAR" | "FLAGGED" | "IN_PROGRESS" | "UNKNOWN";

/** Maps Checkr report result/adjudication to Match Fit vendor pipeline status. */
export function backgroundCheckOutcomeFromCheckrReport(report: CheckrReport): BackgroundCheckVendorOutcome {
  const status = (report.status ?? "").trim().toLowerCase();
  const result = (report.result ?? "").trim().toLowerCase();
  const adjudication = (report.adjudication ?? "").trim().toLowerCase();

  if (status === "pending" || status === "processing") return "IN_PROGRESS";

  if (result === "clear" || adjudication === "engaged") return "CLEAR";

  if (
    result === "consider" ||
    result === "suspended" ||
    adjudication === "pre_adverse_action" ||
    adjudication === "post_adverse_action"
  ) {
    return "FLAGGED";
  }

  if (status === "complete" && !result) return "IN_PROGRESS";

  return "UNKNOWN";
}
