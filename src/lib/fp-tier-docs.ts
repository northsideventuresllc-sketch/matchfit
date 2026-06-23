import type { FpAccountTier, FpDocType } from "@/lib/fp-account-tier-types";

/** Required document types per tier before listing can go live. */
export const FP_REQUIRED_DOCS_BY_TIER: Record<FpAccountTier, readonly FpDocType[]> = {
  match_fit_pro: ["professional_certification"],
  match_fit_premium_pro: ["professional_certification"],
  independent_fitness_pro: [
    "business_registration",
    "liability_insurance",
    "professional_certification",
    "facility_proof",
    "headshot",
    "business_logo",
  ],
  elite_fitness_pro: [
    "business_registration",
    "liability_insurance",
    "professional_certification",
    "facility_proof",
    "headshot",
    "business_logo",
  ],
};

export const FP_DOC_TYPE_LABELS: Record<FpDocType, string> = {
  business_registration: "Business registration",
  liability_insurance: "Liability insurance certificate",
  professional_certification: "Professional certifications",
  facility_proof: "Facility proof (if applicable)",
  headshot: "Headshot",
  business_logo: "Business logo",
};

export function fpRequiredDocsForTier(tier: FpAccountTier): readonly FpDocType[] {
  return FP_REQUIRED_DOCS_BY_TIER[tier];
}

export function fpTierRequiresPremiumVerification(tier: FpAccountTier): boolean {
  return tier === "match_fit_premium_pro";
}

export type FpDocSubmissionSummary = {
  docType: FpDocType;
  status: string;
  fileUrl: string | null;
};

export function fpDocsCompleteForTier(
  tier: FpAccountTier,
  docs: FpDocSubmissionSummary[],
): boolean {
  const required = fpRequiredDocsForTier(tier);
  return required.every((docType) => {
    const row = docs.find((d) => d.docType === docType);
    return row?.status === "approved";
  });
}

export function fpDocsSubmittedForTier(
  tier: FpAccountTier,
  docs: FpDocSubmissionSummary[],
): boolean {
  const required = fpRequiredDocsForTier(tier);
  return required.every((docType) => {
    const row = docs.find((d) => d.docType === docType);
    return row != null && row.status !== "rejected";
  });
}
