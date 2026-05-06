/** Certified fitness specialist roles (mutually exclusive CPT path alternative). */
export const SPECIALIST_ROLE_IDS = ["cscs", "corrective_exercise_specialist", "group_fitness_instructor"] as const;
export type SpecialistProfessionalRoleId = (typeof SPECIALIST_ROLE_IDS)[number];

export const SPECIALIST_ROLE_OPTIONS: {
  id: SpecialistProfessionalRoleId;
  label: string;
  description: string;
}[] = [
  {
    id: "cscs",
    label: "CSCS — Certified Strength and Conditioning Specialist (NSCA)",
    description: "Strength and conditioning for athletes and performance-focused clients.",
  },
  {
    id: "corrective_exercise_specialist",
    label: "Corrective Exercise Specialist (e.g., NASM-CES)",
    description: "Movement assessment, corrective exercise, and return-to-activity programming.",
  },
  {
    id: "group_fitness_instructor",
    label: "NCCA-accredited group fitness instructor",
    description: "Live group formats (e.g., ACE GFI, AFAA) where a national accreditation is required to lead classes.",
  },
];

export function isSpecialistProfessionalRoleId(v: string | null | undefined): v is SpecialistProfessionalRoleId {
  return Boolean(v && SPECIALIST_ROLE_IDS.includes(v as SpecialistProfessionalRoleId));
}
