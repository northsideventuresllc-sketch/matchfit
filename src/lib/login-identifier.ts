/**
 * Normalizes email / @username / phone login identifiers for client and trainer sign-in.
 */
export function normalizeLoginIdentifier(raw: string): {
  email?: string;
  username?: string;
  phone?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  if (!withoutAt) return {};

  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (emailLike) {
    return { email: trimmed.toLowerCase() };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  const compact = trimmed.replace(/\s/g, "");
  if (digitsOnly.length >= 10 && digitsOnly.length >= compact.length * 0.6) {
    return { phone: trimmed };
  }

  return { username: withoutAt };
}
