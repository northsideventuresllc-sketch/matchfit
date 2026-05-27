import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

/** Prisma v7 client for Node scripts (Direct TCP via pg adapter). */
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
