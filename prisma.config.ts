import "dotenv/config";
import { defineConfig } from "prisma/config";

/** CLI migrations use direct Postgres; falls back for `prisma generate` when env is unset (CI/build). */
const migrationUrl =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://127.0.0.1:5432/prisma_cli_placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env scripts/seed-bootstrap-admin.js",
  },
  datasource: {
    url: migrationUrl,
  },
});
