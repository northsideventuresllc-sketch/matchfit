/** Public origin from env (emails, cron). Falls back to production domain in production. */
export function getAppOriginFromEnv(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "https://match-fit.net";
  return "http://localhost:3000";
}

/** Public origin for links in emails (password reset, etc.). */
export function getAppOriginFromRequest(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}
