import { z } from "zod";
import { firstZodErrorMessage } from "@/lib/validations/client-register";

export { firstZodErrorMessage };

const addr = (max: number) => z.string().trim().max(max).nullable().optional();

export const settingsProfilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    preferredName: z.string().trim().min(1, "Preferred name is required.").max(80).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    addressLine1: addr(200),
    addressLine2: addr(200),
    addressCity: addr(120),
    addressState: addr(120),
    addressPostal: addr(32),
    addressCountry: addr(120),
  })
  .refine(
    (o) =>
      o.firstName !== undefined ||
      o.lastName !== undefined ||
      o.preferredName !== undefined ||
      o.bio !== undefined ||
      o.addressLine1 !== undefined ||
      o.addressLine2 !== undefined ||
      o.addressCity !== undefined ||
      o.addressState !== undefined ||
      o.addressPostal !== undefined ||
      o.addressCountry !== undefined,
    { message: "No changes provided.", path: ["preferredName"] },
  );

export const settingsUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only use letters, numbers, and underscores."),
  currentPassword: z.string().min(1, "Current password is required."),
});

export const settingsEmailChangeStartSchema = z.object({
  newEmail: z.string().trim().email("Enter a valid email address.").max(254),
  currentPassword: z.string().min(1, "Current password is required."),
});

export const settingsPhoneChangeStartSchema = z.object({
  newPhone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number (at least 10 digits).")
    .max(32),
  currentPassword: z.string().min(1, "Current password is required."),
});

export const settingsPhoneChangeCompleteSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const settingsEmailChangeCompleteSchema = z.object({
  token: z.string().min(1),
});

const allowedAvatar = new Set(["image/jpeg", "image/png", "image/webp"]);
const extByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function assertAvatarMime(mime: string): string {
  if (!allowedAvatar.has(mime)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  const ext = extByMime[mime];
  if (!ext) throw new Error("Unsupported image type.");
  return ext;
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
