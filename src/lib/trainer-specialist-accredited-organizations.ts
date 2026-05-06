/** Issuing bodies and credentials commonly accepted for the certified specialist path (CSCS, CES, group fitness). */
export const CREDIBLE_SPECIALIST_CREDENTIALS: readonly { issuer: string; credential: string; note?: string }[] = [
  {
    issuer: "National Strength and Conditioning Association (NSCA)",
    credential: "Certified Strength and Conditioning Specialist® (CSCS®)",
    note: "NCCA-accredited; widely required for collegiate and pro strength & conditioning roles.",
  },
  {
    issuer: "National Academy of Sports Medicine (NASM)",
    credential: "Corrective Exercise Specialist (NASM-CES)",
    note: "NCCA-accredited corrective exercise specialty.",
  },
  {
    issuer: "American Council on Exercise (ACE)",
    credential: "Corrective Exercise Specialist (ACE-CES)",
    note: "NCCA-accredited specialty for movement dysfunction.",
  },
  {
    issuer: "American Council on Exercise (ACE)",
    credential: "Group Fitness Instructor Certification (ACE GFI)",
    note: "NCCA-accredited group exercise leader credential.",
  },
  {
    issuer: "National Academy of Sports Medicine (NASM)",
    credential: "Group Personal Training Specialist (NASM-GPTS) / related group formats",
    note: "Often paired with CPT for small-group coaching in clubs.",
  },
  {
    issuer: "Athletics and Fitness Association of America (AFAA)",
    credential: "AFAA Primary Group Exercise Certification (legacy / NASM family)",
    note: "Historically standard for health-club group fitness hiring.",
  },
  {
    issuer: "National Exercise Trainers Association (NETA)",
    credential: "NETA Group Exercise Instructor",
    note: "NCCA-accredited group fitness leader certification.",
  },
  {
    issuer: "American College of Sports Medicine (ACSM)",
    credential: "ACSM Certified Group Exercise Instructor®",
    note: "NCCA-accredited group instruction credential.",
  },
] as const;
