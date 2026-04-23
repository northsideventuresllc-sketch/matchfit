import { z } from "zod";

function truthyFlag(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Trim string fields and coerce booleans; does not invent profile defaults. */
export function normalizeRegisterJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  const next: Record<string, unknown> = { ...o };

  next.agreedToTerms = truthyFlag(o.agreedToTerms) ? true : o.agreedToTerms;
  if ("skipTwoFactor" in o) {
    next.skipTwoFactor = truthyFlag(o.skipTwoFactor) ? true : o.skipTwoFactor;
  }
  if ("stayLoggedIn" in o) {
    const v = o.stayLoggedIn;
    next.stayLoggedIn = v === false || v === "false" || v === 0 || v === "0" ? false : true;
  }

  const trimKeys = [
    "firstName",
    "lastName",
    "preferredName",
    "username",
    "phone",
    "email",
    "zipCode",
    "dateOfBirth",
  ] as const;
  for (const k of trimKeys) {
    if (typeof next[k] === "string") next[k] = (next[k] as string).trim();
  }

  return next;
}

/** Client-side copy of password rules (keeps messaging aligned with `passwordPolicySchema`). */
export function describePasswordPolicyViolations(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one capital letter.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character.";
  return null;
}

export function firstZodErrorMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid data.";
  if (issue.message && !issue.message.startsWith("Invalid literal")) {
    return issue.message;
  }
  const key = issue.path[0];
  return typeof key === "string" ? `Invalid ${key.replace(/([A-Z])/g, " $1").trim()}.` : "Invalid data.";
}

export const passwordPolicySchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[A-Z]/, "Password must include at least one capital letter.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.");

export const registerProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  preferredName: z.string().trim().min(1, "Preferred name is required.").max(80),
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
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid US ZIP code (5 digits or ZIP+4)."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."),
  agreedToTerms: z.literal(true),
});

export const registerSkipSchema = registerProfileSchema.extend({
  skipTwoFactor: z.literal(true),
  stayLoggedIn: z.boolean().optional().default(true),
});

export const registerPending2faSchema = registerProfileSchema.extend({
  twoFactorMethod: z.enum(["EMAIL", "SMS", "VOICE"]),
  stayLoggedIn: z.boolean().optional().default(true),
});

export const completePendingSchema = z.object({
  pendingId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  stayLoggedIn: z.boolean().optional().default(true),
});

export const settings2faSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("disable"),
    password: z.string().min(1),
  }),
  z.object({
    action: z.literal("request_add_channel"),
    password: z.string().min(1),
    delivery: z.enum(["EMAIL", "SMS", "VOICE"]),
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
  }),
  z.object({
    action: z.literal("confirm_add_channel"),
    channelId: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
  }),
  z.object({
    action: z.literal("delete_channel"),
    password: z.string().min(1),
    channelId: z.string().min(1),
  }),
  z.object({
    action: z.literal("set_default_login_channel"),
    password: z.string().min(1),
    channelId: z.string().min(1),
  }),
  z.object({
    action: z.literal("resend_channel_verify"),
    password: z.string().min(1),
    channelId: z.string().min(1),
  }),
  z.object({
    action: z.literal("abandon_unverified_channels"),
  }),
]);

export const settingsSessionSchema = z.object({
  stayLoggedIn: z.boolean(),
});

export const passwordChangeCompleteSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("email"),
    token: z.string().min(1),
    newPassword: passwordPolicySchema,
  }),
  z.object({
    mode: z.literal("otp"),
    code: z.string().regex(/^\d{6}$/),
    newPassword: passwordPolicySchema,
  }),
]);
