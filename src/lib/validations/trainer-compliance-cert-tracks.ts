import { z } from "zod";
import { SPECIALIST_ROLE_IDS } from "@/lib/trainer-specialist-roles";

export const trainerComplianceCertTracksSchema = z
  .object({
    trackCpt: z.boolean(),
    trackNutrition: z.boolean(),
    trackSpecialist: z.boolean(),
    specialistRole: z.enum(SPECIALIST_ROLE_IDS).nullable().optional(),
  })
  .refine((d) => d.trackCpt || d.trackNutrition || d.trackSpecialist, {
    message: "Select at least one credential path to keep on file.",
    path: ["trackCpt"],
  })
  .refine((d) => !(d.trackCpt && d.trackSpecialist), {
    message: "Choose either CPT or the certified specialist path for training—not both.",
    path: ["trackSpecialist"],
  })
  .refine((d) => !d.trackSpecialist || (d.specialistRole != null && d.specialistRole.length > 0), {
    message: "Select which certified specialist role applies when that path is enabled.",
    path: ["specialistRole"],
  });

export type TrainerComplianceCertTracksInput = z.infer<typeof trainerComplianceCertTracksSchema>;
