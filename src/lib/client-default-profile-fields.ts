import { isUsernameTaken } from "@/lib/client-queries";

/** Local part of email — the segment before `@`. */
export function defaultUsernameFromEmail(email: string): string {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  let username = local
    .replace(/[^a-z0-9_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (username.length < 3) {
    username = `${username}_user`.replace(/_+/g, "_").slice(0, 32);
  }
  if (username.length < 3) {
    username = "matchfit_user".slice(0, 32);
  }
  return username.slice(0, 32);
}

export async function resolveUniqueClientUsername(email: string, preferred?: string | null): Promise<string> {
  const candidates: string[] = [];
  const trimmedPreferred = preferred?.trim();
  if (trimmedPreferred && trimmedPreferred.length >= 3) {
    candidates.push(trimmedPreferred);
  }
  candidates.push(defaultUsernameFromEmail(email));

  for (const base of candidates) {
    const sanitized = base
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 32);
    if (sanitized.length < 3) continue;
    if (!(await isUsernameTaken(sanitized))) return sanitized;

    for (let i = 2; i <= 99; i += 1) {
      const suffix = String(i);
      const withSuffix = `${sanitized.slice(0, Math.max(3, 32 - suffix.length))}${suffix}`;
      if (!(await isUsernameTaken(withSuffix))) return withSuffix;
    }
  }

  const fallbackBase = defaultUsernameFromEmail(email);
  for (let i = 2; i <= 999; i += 1) {
    const suffix = String(i);
    const candidate = `${fallbackBase.slice(0, Math.max(3, 32 - suffix.length))}${suffix}`;
    if (!(await isUsernameTaken(candidate))) return candidate;
  }

  return `${fallbackBase.slice(0, 24)}_${Date.now().toString(36).slice(-6)}`.slice(0, 32);
}

export function defaultPreferredNameFromSignup(firstName: string, lastName: string, preferred?: string | null): string {
  const trimmed = preferred?.trim();
  if (trimmed) return trimmed.slice(0, 80);
  const fn = firstName.trim();
  if (fn) return fn.slice(0, 80);
  return lastName.trim().slice(0, 80) || "Member";
}
