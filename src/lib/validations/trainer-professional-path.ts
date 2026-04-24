import { z } from "zod";

export const trainerProfessionalPathSchema = z
  .object({
    trackCpt: z.boolean(),
    trackNutrition: z.boolean(),
    confirmCredentialRequirements: z.boolean(),
  })
  .refine((d) => d.trackCpt || d.trackNutrition, {
    message: "Select at least one professional path.",
    path: ["trackCpt"],
  })
  .refine((d) => d.confirmCredentialRequirements === true, {
    message: "Confirm that you understand the certification requirements for your selection.",
    path: ["confirmCredentialRequirements"],
  });
