import { CREDIBLE_CPT_ORGANIZATIONS } from "@/app/trainer/onboarding/credible-cpt-organizations";
import { CREDIBLE_NUTRITION_CREDENTIALS } from "@/app/trainer/onboarding/credible-nutrition-credentials";
import { SPECIALIST_ROLE_OPTIONS } from "@/lib/trainer-specialist-roles";
import { CREDIBLE_SPECIALIST_CREDENTIALS } from "@/lib/trainer-specialist-accredited-organizations";

export type CredibleOrgRow = { issuer: string; credential: string; note?: string };

/** Optional “supporting credential” — common add-ons beyond primary CPT/RDN/specialist paths. */
export const CREDIBLE_ADDITIONAL_CERTIFICATION_EXAMPLES: readonly CredibleOrgRow[] = [
  {
    issuer: "Various NCCA-accredited bodies",
    credential: "Specialty certifications (e.g., SCS, PES, GFI, yoga alliance RYT where applicable)",
    note: "Upload credentials that gyms or employers already recognize for the service you advertise.",
  },
  {
    issuer: "State / provincial boards",
    credential: "Licensed massage therapy, athletic training, or similar (where applicable)",
    note: "Include scope-of-practice notes when regulations apply.",
  },
  {
    issuer: "Continuing education providers",
    credential: "Advanced certificates (nutrition, behavior change, seniors, pre/postnatal, etc.)",
    note: "Best when paired with a primary CPT, RDN, or specialist credential above.",
  },
];

export type TrainerCertificationPositionReference = {
  id: string;
  positionLabel: string;
  summary: string;
  exampleCredentialNames: string[];
  accreditingBodies: readonly CredibleOrgRow[];
};

export const TRAINER_CERTIFICATION_POSITIONS_REFERENCE: readonly TrainerCertificationPositionReference[] = [
  {
    id: "cpt",
    positionLabel: "Certified Personal Trainer (CPT)",
    summary:
      "Primary personal-training path for one-on-one and program-based coaching. Upload an active CPT from a nationally recognized, employer-trusted issuer.",
    exampleCredentialNames: CREDIBLE_CPT_ORGANIZATIONS.map((o) => o.credential),
    accreditingBodies: CREDIBLE_CPT_ORGANIZATIONS,
  },
  {
    id: "nutrition",
    positionLabel: "Registered Dietitian Nutritionist (RDN) & related nutrition credentials",
    summary:
      "Nutrition coaching, meal guidance, and education within your scope of practice. RDN/RD is the clinical gold standard; other listed credentials are common in fitness and wellness settings.",
    exampleCredentialNames: CREDIBLE_NUTRITION_CREDENTIALS.map((o) => o.credential),
    accreditingBodies: CREDIBLE_NUTRITION_CREDENTIALS,
  },
  {
    id: "specialist",
    positionLabel: "Certified fitness specialist (CPT alternative for training services)",
    summary:
      "Choose one specialist role: CSCS®, corrective exercise specialty, or NCCA-accredited group fitness instruction. Mutually exclusive with the CPT upload path for Match Fit training offerings.",
    exampleCredentialNames: SPECIALIST_ROLE_OPTIONS.map((o) => o.label),
    accreditingBodies: CREDIBLE_SPECIALIST_CREDENTIALS,
  },
  {
    id: "additional",
    positionLabel: "Additional certification (optional)",
    summary:
      "Supporting credentials that strengthen your profile—specialty certs, licenses, or advanced study. Does not replace CPT, RDN/specialist nutrition, or specialist training paths for primary verification.",
    exampleCredentialNames: [
      "NASM PES / CES add-ons",
      "ACE Health Coach / TFC",
      "Precision Nutrition L1 / L2",
      "Yoga Alliance RYT-200+",
    ],
    accreditingBodies: CREDIBLE_ADDITIONAL_CERTIFICATION_EXAMPLES,
  },
] as const;
