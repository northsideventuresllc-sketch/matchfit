/** Nutrition credentials commonly accepted alongside CPT in coaching and clinical-adjacent settings. */
export const CREDIBLE_NUTRITION_CREDENTIALS: readonly { issuer: string; credential: string; note?: string }[] = [
  {
    issuer: "Commission on Dietetic Registration (CDR)",
    credential: "Registered Dietitian Nutritionist (RDN) / Registered Dietitian (RD)",
    note: "Gold standard for medical nutrition therapy in the U.S.",
  },
  {
    issuer: "Board for Certification of Nutrition Specialists (BCNS)",
    credential: "Certified Nutrition Specialist® (CNS®)",
    note: "Advanced nutrition credential with graduate-level pathway.",
  },
  {
    issuer: "National Academy of Sports Medicine (NASM)",
    credential: "NASM Certified Nutrition Coach (CNC)",
    note: "Common add-on for personal trainers in gym settings.",
  },
  {
    issuer: "International Sports Sciences Association (ISSA)",
    credential: "ISSA Nutritionist Certification",
    note: "Frequently paired with CPT in independent coaching.",
  },
  {
    issuer: "Precision Nutrition",
    credential: "Level 1 / Level 2 Nutrition Coach",
    note: "Widely used behavior-change nutrition coaching framework.",
  },
  {
    issuer: "Institute for Integrative Nutrition (IIN)",
    credential: "IIN Health Coach Certificate",
    note: "Recognized in wellness coaching; scope varies by jurisdiction.",
  },
] as const;
