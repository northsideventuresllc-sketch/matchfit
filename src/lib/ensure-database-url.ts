/**
 * Prisma requires DATABASE_URL. When it is missing, default to the repo SQLite file
 * so local dev and `next build` do not fail. For hosted production, set DATABASE_URL
 * explicitly (e.g. Postgres) in your host environment.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/dev.db";
}
