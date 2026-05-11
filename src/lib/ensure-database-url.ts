/**
 * Prisma requires DATABASE_URL (PostgreSQL in production). Set it in `.env` or the host environment.
 *
 * For legacy SQLite `file:` URLs only, a `busy_timeout` query parameter is appended so concurrent
 * readers/writers wait instead of failing immediately with SQLITE_BUSY during Next dev.
 */
function appendSqliteBusyTimeout(url: string): string {
  if (!url.startsWith("file:")) return url;
  if (/[?&]busy_timeout=/i.test(url)) return url;
  return url.includes("?") ? `${url}&busy_timeout=15000` : `${url}?busy_timeout=15000`;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = appendSqliteBusyTimeout(process.env.DATABASE_URL);
}
