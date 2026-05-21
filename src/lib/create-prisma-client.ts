import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import "server-only";

import { PrismaClient } from "@/generated/prisma/client";

const BUILD_PLACEHOLDER_DATABASE_URL =
  "postgresql://build:build@127.0.0.1:1/matchfit_build_placeholder";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  // `next build` imports server modules to collect page data; no live DB is required.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return BUILD_PLACEHOLDER_DATABASE_URL;
  }
  throw new Error("DATABASE_URL is required for Prisma.");
}

/** Shared Prisma v7 client factory (Direct TCP via `@prisma/adapter-pg`). */
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl(),
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}
