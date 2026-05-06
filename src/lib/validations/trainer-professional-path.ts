import { z } from "zod";
import { SPECIALIST_ROLE_IDS } from "@/lib/trainer-specialist-roles";

export const trainerProfessionalPathSchema = z
  .object({
    trackCpt: z.boolean(),
    trackNutrition: z.boolean(),
    trackSpecialist: z.boolean(),
    specialistRole: z.enum(SPECIALIST_ROLE_IDS).optional().nullable(),
    confirmCredentialRequirements: z.boolean(),
  })
  .refine((d) => d.trackCpt || d.trackNutrition || d.trackSpecialist, {
    message: "Select at least one professional path.",
    path: ["trackCpt"],
  })
  .refine((d) => !(d.trackCpt && d.trackSpecialist), {
    message: "Choose either CPT or another certified specialist path for training—not both.",
    path: ["trackSpecialist"],
  })
  .refine((d) => !d.trackSpecialist || (d.specialistRole != null && d.specialistRole.length > 0), {
    message: "Select which certified specialist role applies to you.",
    path: ["specialistRole"],
  })
  .refine((d) => d.confirmCredentialRequirements === true, {
    message: "Confirm that you understand the certification requirements for your selection.",
    path: ["confirmCredentialRequirements"],
  });
