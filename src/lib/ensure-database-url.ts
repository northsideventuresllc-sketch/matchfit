/**
 * Prisma requires DATABASE_URL. When it is missing, default to the repo SQLite file
 * so local dev and `next build` do not fail. For hosted production, set DATABASE_URL
 * explicitly (e.g. Postgres) in your host environment.
 *
 * For SQLite `file:` URLs, a `busy_timeout` query parameter is appended so concurrent
 * readers/writers wait instead of failing immediately with SQLITE_BUSY during Next dev.
 */
function appendSqliteBusyTimeout(url: string): string {
  if (!url.startsWith("file:")) return url;
  if (/[?&]busy_timeout=/i.test(url)) return url;
  return url.includes("?") ? `${url}&busy_timeout=15000` : `${url}?busy_timeout=15000`;
}

const DEFAULT_SQLITE = "file:./prisma/dev.db";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = appendSqliteBusyTimeout(DEFAULT_SQLITE);
} else {
  process.env.DATABASE_URL = appendSqliteBusyTimeout(process.env.DATABASE_URL);
}
