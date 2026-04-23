import { z } from "zod";
import { TRAINER_POST_AUTH_PATHS } from "@/lib/trainer-post-auth-redirect";
import { passwordPolicySchema } from "@/lib/validations/client-register";

export const trainerLoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  stayLoggedIn: z.boolean().optional().default(true),
  redirectAfterLogin: z.enum(TRAINER_POST_AUTH_PATHS).optional(),
});

export const trainerSignupSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(80),
    lastName: z.string().trim().min(1, "Last name is required.").max(80),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/, "Username may only use letters, numbers, and underscores."),
    phone: z
      .string()
      .trim()
      .min(10, "Enter a valid phone number (at least 10 digits).")
      .max(32),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    password: passwordPolicySchema,
    agreedToTerms: z.boolean(),
    stayLoggedIn: z.boolean().optional().default(true),
  })
  .refine((d) => d.agreedToTerms === true, {
    message: "You must accept the Terms of Service.",
    path: ["agreedToTerms"],
  });

export const trainerBasicProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  preferredName: z.string().trim().max(80).optional().default(""),
  bio: z.string().trim().max(2000).optional().default(""),
  pronouns: z.string().trim().max(80).optional().default(""),
  ethnicity: z.string().trim().max(120).optional().default(""),
  languagesSpoken: z.string().trim().max(500).optional().default(""),
  fitnessNiches: z.string().trim().max(2000).optional().default(""),
  yearsCoaching: z.string().trim().max(40).optional().default(""),
  genderIdentity: z.string().trim().max(120).optional().default(""),
  socialInstagram: z.string().trim().max(120).optional().default(""),
  socialTiktok: z.string().trim().max(120).optional().default(""),
  socialFacebook: z.string().trim().max(120).optional().default(""),
  socialLinkedin: z.string().trim().max(120).optional().default(""),
  socialOtherUrl: z.string().trim().max(500).optional().default(""),
});

export const trainerAgreementsSchema = z
  .object({
    acceptedTrainerAgreement: z.boolean(),
  })
  .refine((d) => d.acceptedTrainerAgreement === true, {
    message: "You must acknowledge the trainer agreement.",
    path: ["acceptedTrainerAgreement"],
  });

export const trainerW9StepSchema = z
  .object({
    legalName: z.string().trim().min(1, "Legal name is required.").max(160),
    businessName: z.string().trim().max(160).optional().default(""),
    federalTaxClassification: z.string().trim().min(1, "Select a tax classification.").max(120),
    addressLine1: z.string().trim().min(1, "Street address is required.").max(160),
    addressLine2: z.string().trim().max(160).optional().default(""),
    city: z.string().trim().min(1, "City is required.").max(120),
    state: z.string().trim().min(2, "State is required.").max(2),
    zip: z.string().trim().min(1, "ZIP or postal code is required.").max(20),
    tinType: z.enum(["SSN", "EIN"]),
    tin: z.string().trim().min(4, "Tax identification number is required.").max(32),
    certify: z.boolean(),
  })
  .strict()
  .refine((d) => d.certify === true, {
    message: "You must certify that the information is correct.",
    path: ["certify"],
  });

/** @deprecated Use trainerAgreementsSchema + trainerW9StepSchema from onboarding steps 1 and 4. */
export const trainerLegalStepSchema = z
  .object({
    acceptTrainerTerms: z.boolean(),
    w9Acknowledged: z.boolean().optional().default(false),
  })
  .refine((d) => d.acceptTrainerTerms === true, {
    message: "You must accept the trainer Terms of Service.",
    path: ["acceptTrainerTerms"],
  });
