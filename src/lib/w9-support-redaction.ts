/** Shape saved in `TrainerProfile.w9Json` (subset used on compliance pages). */
export type W9StoredSupport = {
  legalName?: string;
  businessName?: string;
  federalTaxClassification?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  tinType?: string;
  tin?: string;
  submittedAt?: string;
};

/**
 * Match Fit staff must not view full SSN digits during impersonation; EIN remains masked in UI as usual.
 */
export function redactW9SsnForSupportSession(w9: W9StoredSupport | null): W9StoredSupport | null {
  if (!w9) return null;
  const tinType = (w9.tinType ?? "").trim().toUpperCase();
  if (tinType === "SSN") {
    return { ...w9, tin: undefined };
  }
  return w9;
}
