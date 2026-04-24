/** Title-case labels for dashboard compliance rows (not raw enum strings). */
export function backgroundCheckStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "NOT_STARTED").trim();
  switch (s) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Pending";
    case "NOT_STARTED":
      return "Not Started";
    case "NEEDS_FURTHER_REVIEW":
      return "Needs Further Review";
    case "DENIED":
      return "Denied";
    default:
      return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function certificationReviewStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "NOT_STARTED").trim();
  switch (s) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Pending Review";
    case "NOT_STARTED":
      return "Not Started";
    case "DENIED":
      return "Denied";
    default:
      return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
