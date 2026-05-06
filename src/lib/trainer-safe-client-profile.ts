/**
 * Trainer-facing APIs must never return private mailing-address fields (schema: `addressLine*`).
 * Use these selects or {@link assertTrainerClientPayloadHasNoAddress} in reviews.
 */

export const TRAINER_SAFE_CLIENT_MIN_SELECT = {
  id: true,
  username: true,
  preferredName: true,
  firstName: true,
  lastName: true,
  zipCode: true,
  bio: true,
  profileImageUrl: true,
  matchPreferencesJson: true,
  matchPreferencesCompletedAt: true,
  allowTrainerDiscovery: true,
} as const;

/** Keys that must never appear in JSON returned to trainers for a client. */
const FORBIDDEN_ADDRESS_KEYS = new Set([
  "addressLine1",
  "addressLine2",
  "addressCity",
  "addressState",
  "addressPostal",
  "addressCountry",
  "physical_address",
  "physicalAddress",
]);

export function assertTrainerClientPayloadHasNoAddress(payload: unknown, context: string): void {
  if (!payload || typeof payload !== "object") return;
  const walk = (obj: unknown, path: string) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (FORBIDDEN_ADDRESS_KEYS.has(k)) {
        throw new Error(`[Address shield] ${context}: forbidden key "${p}"`);
      }
      if (v && typeof v === "object") walk(v, p);
    }
  };
  walk(payload, "");
}
