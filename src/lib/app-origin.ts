/** Public site origin from env (server jobs, cron, Plan B emails). */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return fromEnv || "https://match-fit.net";
}

/** Public origin for links in emails (password reset, etc.). */
export function getAppOriginFromRequest(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}
