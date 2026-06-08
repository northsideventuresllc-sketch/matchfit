import { prisma } from "@/lib/prisma";

export type SignupFormRole = "client" | "trainer";

export const CLIENT_SIGNUP_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "password",
  "zipCode",
  "dateOfBirth",
  "agreedToTerms",
] as const;

export const TRAINER_SIGNUP_FIELDS = [
  "firstName",
  "lastName",
  "username",
  "phone",
  "email",
  "password",
  "serviceZipCode",
  "agreedToTerms",
] as const;

export type ClientSignupField = (typeof CLIENT_SIGNUP_FIELDS)[number];
export type TrainerSignupField = (typeof TRAINER_SIGNUP_FIELDS)[number];

export function signupFieldsForRole(role: SignupFormRole): readonly string[] {
  return role === "client" ? CLIENT_SIGNUP_FIELDS : TRAINER_SIGNUP_FIELDS;
}

export function computeSignupProgressPercent(
  role: SignupFormRole,
  fields: Record<string, boolean>,
): number {
  const all = signupFieldsForRole(role);
  const filled = all.filter((f) => fields[f]).length;
  return all.length > 0 ? Math.round((filled / all.length) * 100) : 0;
}

export function resolveSignupProgressStage(
  role: SignupFormRole,
  fields: Record<string, boolean>,
): "started_signup" | "basic_info_complete" | "completed" {
  const all = signupFieldsForRole(role);
  const withoutTos = all.filter((f) => f !== "agreedToTerms");
  const basicComplete = withoutTos.every((f) => fields[f]);
  if (fields.agreedToTerms && basicComplete) return "completed";
  if (basicComplete) return "basic_info_complete";
  const pct = computeSignupProgressPercent(role, fields);
  return pct >= 50 ? "started_signup" : "started_signup";
}

export function parseSignupFieldsJson(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === true) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export async function upsertSignupFormProgress(args: {
  role: SignupFormRole;
  visitorId: string;
  fields: Record<string, boolean>;
  email?: string | null;
  username?: string | null;
}): Promise<void> {
  const visitorId = args.visitorId.trim();
  if (!visitorId) return;

  const stage = resolveSignupProgressStage(args.role, args.fields);
  const fieldsJson = JSON.stringify(args.fields);

  await prisma.signupFormProgress.upsert({
    where: { role_visitorId: { role: args.role, visitorId } },
    create: {
      role: args.role,
      visitorId,
      email: args.email?.trim().toLowerCase() || null,
      username: args.username?.trim() || null,
      fieldsJson,
      stage,
    },
    update: {
      email: args.email?.trim().toLowerCase() || undefined,
      username: args.username?.trim() || undefined,
      fieldsJson,
      stage,
    },
  });
}

export function listFilledSignupFields(
  role: SignupFormRole,
  fields: Record<string, boolean>,
): { filled: string[]; missing: string[] } {
  const all = signupFieldsForRole(role);
  const filled = all.filter((f) => fields[f]);
  const missing = all.filter((f) => !fields[f]);
  return { filled, missing };
}
