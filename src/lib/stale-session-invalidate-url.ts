/** Same-origin relative paths only (avoids open redirects via `redirect` query). */
function safeRelativePath(path: string, fallback: string): string {
  const t = path.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}

/** GET this URL from a Server Component to clear an invalid trainer cookie, then land on `next`. */
export function staleTrainerSessionInvalidateRedirect(next = "/trainer/dashboard/login"): string {
  const path = safeRelativePath(next, "/trainer/dashboard/login");
  return `/api/trainer/session/invalidate?redirect=${encodeURIComponent(path)}`;
}

/** GET this URL from a Server Component to clear an invalid client cookie, then land on `next`. */
export function staleClientSessionInvalidateRedirect(next = "/client"): string {
  const path = safeRelativePath(next, "/client");
  return `/api/client/session/invalidate?redirect=${encodeURIComponent(path)}`;
}
