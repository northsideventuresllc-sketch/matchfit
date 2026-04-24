/**
 * Widely recognized CPT (Certified Personal Trainer) credentials and issuing bodies.
 * Many commercial gyms prefer NCCA-accredited programs; list includes common U.S. standards.
 */
export const CREDIBLE_CPT_ORGANIZATIONS: readonly { issuer: string; credential: string; note?: string }[] = [
  {
    issuer: "National Academy of Sports Medicine (NASM)",
    credential: "NASM-CPT",
    note: "NCCA-accredited personal trainer certification.",
  },
  {
    issuer: "American Council on Exercise (ACE)",
    credential: "ACE Certified Personal Trainer",
    note: "NCCA-accredited.",
  },
  {
    issuer: "American College of Sports Medicine (ACSM)",
    credential: "ACSM Certified Personal Trainer (ACSM-CPT)",
    note: "NCCA-accredited.",
  },
  {
    issuer: "National Strength and Conditioning Association (NSCA)",
    credential: "NSCA-CPT",
    note: "NCCA-accredited; distinct from CSCS®.",
  },
  {
    issuer: "International Sports Sciences Association (ISSA)",
    credential: "ISSA Certified Personal Trainer",
    note: "Widely accepted; CPT program is NCCA-accredited.",
  },
  {
    issuer: "National Council on Strength & Fitness (NCSF)",
    credential: "NCSF-CPT",
    note: "NCCA-accredited.",
  },
  {
    issuer: "National Federation of Professional Trainers (NFPT)",
    credential: "NFPT-CPT",
    note: "NCCA-accredited.",
  },
  {
    issuer: "National Exercise Trainers Association (NETA)",
    credential: "NETA Certified Personal Trainer",
    note: "NCCA-accredited.",
  },
  {
    issuer: "Cooper Institute",
    credential: "CI-CPT (Cooper Institute Certified Personal Trainer)",
    note: "Established clinical / fitness standard.",
  },
  {
    issuer: "Athletics and Fitness Association of America (AFAA)",
    credential: "AFAA Personal Fitness Trainer (legacy / NASM family)",
    note: "Historically common in health-club hiring.",
  },
  {
    issuer: "Canadian Fitness Education Services (CFES)",
    credential: "CFES Weight Training / Personal Trainer",
    note: "Common in Canadian club chains.",
  },
  {
    issuer: "canfitpro",
    credential: "Personal Training Specialist (PTS)",
    note: "Widely recognized across Canadian facilities.",
  },
] as const;
