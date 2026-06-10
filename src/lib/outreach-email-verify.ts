import "server-only";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
  "fakeinbox.com",
]);

export function normalizeEmailAddress(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function assessEmailLeadContact(email: string): { ok: true; email: string } | { ok: false; reason: string } {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) {
    return { ok: false, reason: "Invalid email address format." };
  }

  const domain = normalized.split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "Disposable email domain — need a real trainer business email." };
  }

  return { ok: true, email: normalized };
}

export function isLikelyPublicEmailSourceUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
