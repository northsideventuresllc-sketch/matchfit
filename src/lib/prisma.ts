import "./ensure-database-url";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Delegates that were added in later schema drops. A cached PrismaClient from an older
 * `prisma generate` may omit them (undefined `.findMany`). Self-heal by replacing the client.
 */
const SELF_HEAL_DELEGATE_KEYS = [
  "sessionTrainerPunchIn",
  "trainerClientGoal",
  "trainerClientCoachingProfile",
  "trainerClientSessionSummary",
  "trainerBusinessMileageEntry",
  "trainerBusinessExpense",
] as const;

function prismaSingletonMatchesGeneratedSchema(client: unknown): boolean {
  const p = client as Record<string, { findMany?: unknown } | undefined>;
  for (const key of SELF_HEAL_DELEGATE_KEYS) {
    const d = p[key];
    if (!d || typeof d.findMany !== "function") return false;
  }
  return true;
}

/** Resolve or replace the cached Prisma singleton. */
function obtainPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && prismaSingletonMatchesGeneratedSchema(existing)) {
    return existing;
  }

  if (existing && !prismaSingletonMatchesGeneratedSchema(existing)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[prisma] Cached PrismaClient is missing model delegates (schema newer than client). Replacing — run `npx prisma generate` after pulls.",
      );
    } else {
      console.error(
        "[prisma] Prisma Client is missing marketplace delegates. Run `npx prisma generate` and redeploy.",
      );
    }
    void existing.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }

  const next = createPrisma();
  globalForPrisma.prisma = next;
  return next;
}

/**
 * Singleton Prisma client (with dev self-heal when generated delegates are missing).
 * Intentionally not a Proxy: wrapping `PrismaClient` breaks some internal `this` bindings
 * ($transaction, engine lifecycle) and can deadlock or freeze the app in dev.
 */
export const prisma: PrismaClient = obtainPrismaClient();
